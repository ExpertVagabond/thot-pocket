"""Export trained GazeTransformer weights for Rust inference.

Supports two export formats:

1. ONNX — standard ML interchange format, usable with ort (ONNX Runtime) crate.
2. Raw weight tensors — .bin files + manifest.json for direct loading with
   custom Rust inference (no ONNX Runtime dependency).

The raw format writes each parameter as a contiguous little-endian f32 buffer
alongside a JSON manifest describing shapes, dtypes, and layer names.

Usage:
    python export_rust.py --checkpoint checkpoints/best.pt --format both
    python export_rust.py --checkpoint checkpoints/best.pt --format onnx --output model.onnx
    python export_rust.py --checkpoint checkpoints/best.pt --format raw --output weights/
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path
from typing import Any

import numpy as np
import torch

from dataset import INPUT_DIM
from model import GazeTransformer


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export GazeTransformer weights for Rust inference",
    )
    parser.add_argument(
        "--checkpoint",
        type=str,
        required=True,
        help="Path to .pt checkpoint file",
    )
    parser.add_argument(
        "--format",
        type=str,
        choices=["onnx", "raw", "both"],
        default="both",
        help="Export format: onnx, raw (bin+json), or both",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output path (file for onnx, directory for raw, directory for both)",
    )
    parser.add_argument("--seq_len", type=int, default=32, help="Sequence length for ONNX export")
    return parser.parse_args()


def load_model_from_checkpoint(ckpt_path: Path) -> tuple[GazeTransformer, dict[str, Any]]:
    """Load a GazeTransformer from a training checkpoint.

    Returns:
        (model, config_dict)
    """
    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=True)

    # Extract config from checkpoint or use defaults
    config = ckpt.get("config", {})
    input_dim = config.get("input_dim", INPUT_DIM)
    d_model = config.get("d_model", 128)
    nhead = config.get("nhead", 4)
    num_layers = config.get("num_layers", 4)
    dropout = config.get("dropout", 0.0)  # 0 for inference
    seq_len = config.get("seq_len", 32)

    model = GazeTransformer(
        input_dim=input_dim,
        d_model=d_model,
        nhead=nhead,
        num_layers=num_layers,
        dropout=dropout,
        max_seq_len=seq_len * 2,
    )

    state_dict = ckpt.get("model_state_dict", ckpt)
    model.load_state_dict(state_dict)
    model.eval()

    return model, config


def export_onnx(
    model: GazeTransformer,
    output_path: Path,
    seq_len: int,
) -> None:
    """Export model to ONNX format.

    The exported model takes input shape (batch, seq_len, INPUT_DIM) and
    produces three outputs: looking_logit, aversion_logits, duration.
    """
    model.eval()
    dummy_input = torch.randn(1, seq_len, INPUT_DIM)

    torch.onnx.export(
        model,
        dummy_input,
        str(output_path),
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
    print(f"Exported ONNX model to {output_path}")

    # Validate
    try:
        import onnx

        onnx_model = onnx.load(str(output_path))
        onnx.checker.check_model(onnx_model)
        print("  ONNX model validation passed")
    except ImportError:
        print("  (onnx package not installed — skipping validation)")
    except Exception as e:
        print(f"  ONNX validation warning: {e}")

    # Test with onnxruntime
    try:
        import onnxruntime as ort

        sess = ort.InferenceSession(str(output_path))
        test_input = np.random.randn(1, seq_len, INPUT_DIM).astype(np.float32)
        outputs = sess.run(None, {"input": test_input})
        print(f"  ONNX runtime test: looking={outputs[0].shape}, aversion={outputs[1].shape}, duration={outputs[2].shape}")
    except ImportError:
        print("  (onnxruntime not installed — skipping runtime test)")
    except Exception as e:
        print(f"  ONNX runtime test warning: {e}")


def export_raw_weights(
    model: GazeTransformer,
    output_dir: Path,
    config: dict[str, Any],
) -> None:
    """Export model weights as raw .bin files with a JSON manifest.

    Each named parameter is written as a contiguous little-endian float32
    buffer.  The manifest.json file maps parameter names to their file,
    shape, dtype, and byte offset/length for memory-mapped loading in Rust.

    Directory structure:
        output_dir/
            manifest.json
            weights.bin        (all params concatenated)
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, Any] = {
        "format": "thot_pocket_gaze_v1",
        "model": "GazeTransformer",
        "config": config,
        "dtype": "float32",
        "byte_order": "little_endian",
        "parameters": {},
    }

    # Write all parameters into a single binary file
    bin_path = output_dir / "weights.bin"
    total_params = 0
    offset = 0

    with open(bin_path, "wb") as f:
        for name, param in model.named_parameters():
            data = param.detach().cpu().numpy().astype(np.float32)
            flat = data.tobytes()  # little-endian on most platforms

            # Ensure little-endian
            if sys.byteorder == "big":
                data = data.byteswap()
                flat = data.tobytes()

            f.write(flat)

            manifest["parameters"][name] = {
                "shape": list(data.shape),
                "numel": int(data.size),
                "byte_offset": offset,
                "byte_length": len(flat),
            }

            offset += len(flat)
            total_params += data.size

    manifest["total_parameters"] = total_params
    manifest["total_bytes"] = offset

    # Write manifest
    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Exported raw weights to {output_dir}/")
    print(f"  weights.bin: {offset:,} bytes ({total_params:,} float32 params)")
    print(f"  manifest.json: {len(manifest['parameters'])} parameter tensors")

    # Also export the buffers (non-parameter persistent tensors like positional encoding)
    buffers_manifest: dict[str, Any] = {"buffers": {}}
    buf_offset = 0

    buf_path = output_dir / "buffers.bin"
    with open(buf_path, "wb") as f:
        for name, buf in model.named_buffers():
            data = buf.detach().cpu().numpy().astype(np.float32)
            flat = data.tobytes()
            if sys.byteorder == "big":
                data = data.byteswap()
                flat = data.tobytes()

            f.write(flat)
            buffers_manifest["buffers"][name] = {
                "shape": list(data.shape),
                "numel": int(data.size),
                "byte_offset": buf_offset,
                "byte_length": len(flat),
            }
            buf_offset += len(flat)

    if buf_offset > 0:
        manifest["buffers_file"] = "buffers.bin"
        manifest["buffers"] = buffers_manifest["buffers"]
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
        print(f"  buffers.bin: {buf_offset:,} bytes ({len(buffers_manifest['buffers'])} buffers)")
    else:
        buf_path.unlink(missing_ok=True)


def verify_export(
    model: GazeTransformer,
    output_dir: Path,
    seq_len: int,
) -> bool:
    """Verify that raw exported weights reproduce the same outputs.

    Loads weights back from the manifest and compares against PyTorch output.
    """
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.exists():
        print("  Skipping verification — no manifest found")
        return False

    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    bin_path = output_dir / "weights.bin"
    with open(bin_path, "rb") as f:
        blob = f.read()

    # Reconstruct state dict from raw bytes
    reconstructed: dict[str, torch.Tensor] = {}
    for name, info in manifest["parameters"].items():
        start = info["byte_offset"]
        end = start + info["byte_length"]
        arr = np.frombuffer(blob[start:end], dtype=np.float32).reshape(info["shape"])
        reconstructed[name] = torch.from_numpy(arr.copy())

    # Build fresh model and load reconstructed weights
    config = manifest.get("config", {})
    check_model = GazeTransformer(
        input_dim=config.get("input_dim", INPUT_DIM),
        d_model=config.get("d_model", 128),
        nhead=config.get("nhead", 4),
        num_layers=config.get("num_layers", 4),
        dropout=0.0,
        max_seq_len=config.get("seq_len", seq_len) * 2,
    )
    check_model.load_state_dict(reconstructed)
    check_model.eval()

    # Compare outputs
    test_input = torch.randn(1, seq_len, INPUT_DIM)
    with torch.no_grad():
        orig = model(test_input)
        recon = check_model(test_input)

    atol = 1e-5
    match_look = torch.allclose(orig.looking_logit, recon.looking_logit, atol=atol)
    match_avert = torch.allclose(orig.aversion_logits, recon.aversion_logits, atol=atol)
    match_dur = torch.allclose(orig.duration, recon.duration, atol=atol)

    if match_look and match_avert and match_dur:
        print("  Verification PASSED: raw weights reproduce identical outputs")
        return True
    else:
        print(f"  Verification FAILED: look={match_look} avert={match_avert} dur={match_dur}")
        return False


def main() -> None:
    args = parse_args()

    ckpt_path = Path(args.checkpoint)
    if not ckpt_path.exists():
        print(f"Error: checkpoint not found: {ckpt_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading checkpoint: {ckpt_path}")
    model, config = load_model_from_checkpoint(ckpt_path)
    config["seq_len"] = config.get("seq_len", args.seq_len)

    n_params = sum(p.numel() for p in model.parameters())
    print(f"Model loaded: {n_params:,} parameters")

    # Determine output paths
    if args.format in ("onnx", "both"):
        if args.output and args.format == "onnx":
            onnx_path = Path(args.output)
        else:
            output_dir = Path(args.output) if args.output else ckpt_path.parent / "export"
            output_dir.mkdir(parents=True, exist_ok=True)
            onnx_path = output_dir / "gaze_transformer.onnx"

        export_onnx(model, onnx_path, args.seq_len)

    if args.format in ("raw", "both"):
        if args.output and args.format == "raw":
            raw_dir = Path(args.output)
        else:
            raw_dir = Path(args.output) if args.output else ckpt_path.parent / "export"

        export_raw_weights(model, raw_dir, config)
        verify_export(model, raw_dir, args.seq_len)

    print("\nExport complete.")


if __name__ == "__main__":
    main()
