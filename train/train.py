"""Training script for the GazeTransformer model.

Trains the model to predict conversational gaze behavior from windowed
sequences of conversation context.  Logs metrics to Weights & Biases,
saves checkpoints, and exports the final model to ONNX.

Usage:
    python train.py --data_path data/gaze.jsonl --epochs 50 --batch_size 64
    python train.py --data_path synthetic --epochs 10  # auto-generate data
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

from dataset import (
    INPUT_DIM,
    GazeSequenceDataset,
    create_synthetic_dataset,
)
from model import GazeLoss, GazePrediction, GazeTransformer, count_parameters


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train GazeTransformer for conversational gaze prediction",
    )
    parser.add_argument(
        "--data_path",
        type=str,
        required=True,
        help="Path to JSONL/CSV data file, or 'synthetic' to auto-generate",
    )
    parser.add_argument("--epochs", type=int, default=50, help="Training epochs")
    parser.add_argument("--batch_size", type=int, default=64, help="Batch size")
    parser.add_argument("--lr", type=float, default=3e-4, help="Learning rate")
    parser.add_argument("--seq_len", type=int, default=32, help="Sequence window length")
    parser.add_argument("--stride", type=int, default=4, help="Window stride")
    parser.add_argument(
        "--checkpoint_dir",
        type=str,
        default="checkpoints",
        help="Directory for model checkpoints",
    )
    parser.add_argument("--wandb_project", type=str, default="thot-pocket-gaze")
    parser.add_argument("--wandb_disabled", action="store_true", help="Disable wandb logging")
    parser.add_argument("--val_split", type=float, default=0.15, help="Validation split ratio")
    parser.add_argument("--d_model", type=int, default=128, help="Transformer model dimension")
    parser.add_argument("--nhead", type=int, default=4, help="Number of attention heads")
    parser.add_argument("--num_layers", type=int, default=4, help="Transformer encoder layers")
    parser.add_argument("--dropout", type=float, default=0.1, help="Dropout rate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument(
        "--export_onnx",
        type=str,
        default=None,
        help="Path to export ONNX model after training (default: checkpoint_dir/gaze_transformer.onnx)",
    )
    return parser.parse_args()


def get_device() -> torch.device:
    """Select best available device."""
    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def train_one_epoch(
    model: GazeTransformer,
    loader: DataLoader,
    criterion: GazeLoss,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
) -> dict[str, float]:
    """Run one training epoch and return average loss components."""
    model.train()
    total_loss = 0.0
    component_sums: dict[str, float] = {}
    n_batches = 0

    for features, targets in loader:
        features = features.to(device)
        targets = targets.to(device)

        optimizer.zero_grad()
        pred = model(features)
        loss, components = criterion(pred, targets)
        loss.backward()

        # Gradient clipping — transformers can spike
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

        optimizer.step()

        total_loss += loss.item()
        for k, v in components.items():
            component_sums[k] = component_sums.get(k, 0.0) + v
        n_batches += 1

    avg = {k: v / max(n_batches, 1) for k, v in component_sums.items()}
    avg["loss_total"] = total_loss / max(n_batches, 1)
    return avg


@torch.no_grad()
def evaluate(
    model: GazeTransformer,
    loader: DataLoader,
    criterion: GazeLoss,
    device: torch.device,
) -> dict[str, float]:
    """Evaluate the model on a dataset and return loss + accuracy metrics."""
    model.eval()
    total_loss = 0.0
    component_sums: dict[str, float] = {}
    correct_looking = 0
    correct_aversion = 0
    total_samples = 0
    total_averting = 0
    n_batches = 0

    for features, targets in loader:
        features = features.to(device)
        targets = targets.to(device)

        pred = model(features)
        loss, components = criterion(pred, targets)

        total_loss += loss.item()
        for k, v in components.items():
            component_sums[k] = component_sums.get(k, 0.0) + v
        n_batches += 1

        # Accuracy: looking prediction
        pred_looking = (torch.sigmoid(pred.looking_logit) > 0.5).float()
        correct_looking += (pred_looking == targets[:, 0]).sum().item()

        # Accuracy: aversion direction (only when not looking)
        not_looking = targets[:, 0] < 0.5
        if not_looking.any():
            pred_dir = pred.aversion_logits[not_looking].argmax(dim=-1)
            true_dir = targets[not_looking, 1:7].argmax(dim=-1)
            correct_aversion += (pred_dir == true_dir).sum().item()
            total_averting += not_looking.sum().item()

        total_samples += targets.size(0)

    avg = {k: v / max(n_batches, 1) for k, v in component_sums.items()}
    avg["loss_total"] = total_loss / max(n_batches, 1)
    avg["acc_looking"] = correct_looking / max(total_samples, 1)
    avg["acc_aversion"] = correct_aversion / max(total_averting, 1)
    return avg


def export_to_onnx(
    model: GazeTransformer,
    onnx_path: Path,
    seq_len: int,
    device: torch.device,
) -> None:
    """Export the trained model to ONNX format for Rust inference."""
    model.eval()
    dummy = torch.randn(1, seq_len, INPUT_DIM, device=device)

    torch.onnx.export(
        model,
        dummy,
        str(onnx_path),
        input_names=["input"],
        output_names=["looking_logit", "aversion_logits", "duration"],
        dynamic_axes={
            "input": {0: "batch_size", 1: "seq_len"},
            "looking_logit": {0: "batch_size"},
            "aversion_logits": {0: "batch_size"},
            "duration": {0: "batch_size"},
        },
        opset_version=17,
    )
    print(f"Exported ONNX model to {onnx_path}")


def main() -> None:
    args = parse_args()

    torch.manual_seed(args.seed)

    # --- wandb ---
    wandb_run = None
    if not args.wandb_disabled:
        try:
            import wandb

            wandb_run = wandb.init(
                project=args.wandb_project,
                config=vars(args),
            )
        except Exception as e:
            print(f"wandb init failed ({e}), continuing without logging")
            wandb_run = None

    # --- Data ---
    if args.data_path == "synthetic":
        data_file = Path(args.checkpoint_dir) / "synthetic_gaze.jsonl"
        data_file.parent.mkdir(parents=True, exist_ok=True)
        print("Generating synthetic training data...")
        create_synthetic_dataset(
            data_file,
            num_conversations=200,
            samples_per_conversation=300,
            seed=args.seed,
        )
        print(f"  Wrote {data_file}")
    else:
        data_file = Path(args.data_path)
        if not data_file.exists():
            print(f"Error: data file not found: {data_file}", file=sys.stderr)
            sys.exit(1)

    dataset = GazeSequenceDataset(data_file, seq_len=args.seq_len, stride=args.stride)
    print(f"Dataset: {len(dataset)} windows (seq_len={args.seq_len}, stride={args.stride})")

    if len(dataset) == 0:
        print("Error: no valid windows in dataset (too few rows per conversation?)", file=sys.stderr)
        sys.exit(1)

    # Train/val split
    val_size = int(len(dataset) * args.val_split)
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(
        dataset,
        [train_size, val_size],
        generator=torch.Generator().manual_seed(args.seed),
    )
    print(f"  Train: {train_size}  Val: {val_size}")

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
        pin_memory=True,
        drop_last=True,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=True,
    )

    # --- Model ---
    device = get_device()
    print(f"Device: {device}")

    model = GazeTransformer(
        input_dim=INPUT_DIM,
        d_model=args.d_model,
        nhead=args.nhead,
        num_layers=args.num_layers,
        dropout=args.dropout,
        max_seq_len=args.seq_len * 2,
    ).to(device)

    n_params = count_parameters(model)
    print(f"Model: {n_params:,} trainable parameters")

    criterion = GazeLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    # --- Checkpoint dir ---
    ckpt_dir = Path(args.checkpoint_dir)
    ckpt_dir.mkdir(parents=True, exist_ok=True)

    best_val_loss = float("inf")

    # --- Training loop ---
    print(f"\nStarting training for {args.epochs} epochs...")
    for epoch in range(1, args.epochs + 1):
        t0 = time.time()

        train_metrics = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_metrics = evaluate(model, val_loader, criterion, device)
        scheduler.step()

        elapsed = time.time() - t0
        lr = optimizer.param_groups[0]["lr"]

        print(
            f"Epoch {epoch:3d}/{args.epochs} "
            f"| train_loss={train_metrics['loss_total']:.4f} "
            f"| val_loss={val_metrics['loss_total']:.4f} "
            f"| val_acc_look={val_metrics['acc_looking']:.3f} "
            f"| val_acc_avert={val_metrics['acc_aversion']:.3f} "
            f"| lr={lr:.2e} "
            f"| {elapsed:.1f}s"
        )

        # wandb logging
        if wandb_run is not None:
            import wandb

            log_data = {"epoch": epoch, "lr": lr}
            for k, v in train_metrics.items():
                log_data[f"train/{k}"] = v
            for k, v in val_metrics.items():
                log_data[f"val/{k}"] = v
            wandb.log(log_data)

        # Save best checkpoint
        if val_metrics["loss_total"] < best_val_loss:
            best_val_loss = val_metrics["loss_total"]
            ckpt_path = ckpt_dir / "best.pt"
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "val_loss": best_val_loss,
                    "config": {
                        "input_dim": INPUT_DIM,
                        "d_model": args.d_model,
                        "nhead": args.nhead,
                        "num_layers": args.num_layers,
                        "dropout": args.dropout,
                        "seq_len": args.seq_len,
                    },
                },
                ckpt_path,
            )
            print(f"  Saved best checkpoint (val_loss={best_val_loss:.4f})")

        # Periodic checkpoint every 10 epochs
        if epoch % 10 == 0:
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "val_loss": val_metrics["loss_total"],
                },
                ckpt_dir / f"epoch_{epoch:03d}.pt",
            )

    # --- Export ---
    # Load best checkpoint for export
    best_ckpt = torch.load(ckpt_dir / "best.pt", map_location=device, weights_only=True)
    model.load_state_dict(best_ckpt["model_state_dict"])
    print(f"\nLoaded best checkpoint from epoch {best_ckpt['epoch']} (val_loss={best_ckpt['val_loss']:.4f})")

    onnx_path = Path(args.export_onnx) if args.export_onnx else ckpt_dir / "gaze_transformer.onnx"
    export_to_onnx(model, onnx_path, args.seq_len, device)

    # Save final PyTorch model too
    torch.save(model.state_dict(), ckpt_dir / "final.pt")
    print(f"Saved final weights to {ckpt_dir / 'final.pt'}")

    if wandb_run is not None:
        import wandb

        wandb.finish()

    print("\nTraining complete.")


if __name__ == "__main__":
    main()
