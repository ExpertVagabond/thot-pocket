"""GazeTransformer — a small transformer model for conversational gaze prediction.

Given a window of recent conversation context (state, gaze zones, culture,
timing), predicts three outputs:

1. Should the avatar look at the user? (binary, sigmoid)
2. If averting, which direction? (6-way softmax over AversionDirection)
3. How long to hold the current gaze episode? (regression, relu)

Architecture: 4-layer transformer encoder, 128-dim, 4 heads.
Designed to export to ONNX for real-time Rust inference at 60 Hz.
"""

from __future__ import annotations

import math
from typing import NamedTuple

import torch
import torch.nn as nn
import torch.nn.functional as F

from dataset import INPUT_DIM, NUM_AVERSION_DIRS


class GazePrediction(NamedTuple):
    """Output of GazeTransformer.forward()."""

    looking_logit: torch.Tensor     # (B,) raw logit — apply sigmoid for prob
    aversion_logits: torch.Tensor   # (B, 6) raw logits — apply softmax
    duration: torch.Tensor          # (B,) predicted contact_duration normalized


class PositionalEncoding(nn.Module):
    """Sinusoidal positional encoding (no learnable params, ONNX-friendly)."""

    def __init__(self, d_model: int, max_len: int = 512) -> None:
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float32).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2, dtype=torch.float32)
            * (-math.log(10000.0) / d_model)
        )
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)  # (1, max_len, d_model)
        self.register_buffer("pe", pe)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: (B, T, D)"""
        return x + self.pe[:, : x.size(1), :]


class GazeTransformer(nn.Module):
    """Small transformer encoder with three prediction heads.

    Args:
        input_dim:   Dimension of per-timestep input features.
        d_model:     Internal transformer dimension.
        nhead:       Number of attention heads.
        num_layers:  Number of transformer encoder layers.
        dim_ff:      Feed-forward hidden dimension.
        dropout:     Dropout rate.
        max_seq_len: Maximum sequence length supported.
    """

    def __init__(
        self,
        input_dim: int = INPUT_DIM,
        d_model: int = 128,
        nhead: int = 4,
        num_layers: int = 4,
        dim_ff: int = 256,
        dropout: float = 0.1,
        max_seq_len: int = 512,
    ) -> None:
        super().__init__()

        # Project raw features to model dimension
        self.input_proj = nn.Linear(input_dim, d_model)
        self.pos_enc = PositionalEncoding(d_model, max_len=max_seq_len)
        self.input_norm = nn.LayerNorm(d_model)

        # Transformer encoder (causal: each timestep only sees past/current)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_ff,
            dropout=dropout,
            batch_first=True,
            activation="gelu",
        )
        self.encoder = nn.TransformerEncoder(
            encoder_layer,
            num_layers=num_layers,
        )

        # Prediction heads — operate on the last timestep's representation
        self.head_looking = nn.Sequential(
            nn.Linear(d_model, d_model // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 2, 1),
        )

        self.head_aversion = nn.Sequential(
            nn.Linear(d_model, d_model // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 2, NUM_AVERSION_DIRS),
        )

        self.head_duration = nn.Sequential(
            nn.Linear(d_model, d_model // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 2, 1),
            nn.ReLU(),  # Duration is non-negative
        )

    def forward(self, x: torch.Tensor) -> GazePrediction:
        """Forward pass.

        Args:
            x: (B, T, INPUT_DIM) — windowed sequence of encoded gaze features.

        Returns:
            GazePrediction with shapes (B,), (B, 6), (B,).
        """
        B, T, _ = x.shape

        # Project and encode
        h = self.input_proj(x)                    # (B, T, d_model)
        h = self.pos_enc(h)
        h = self.input_norm(h)

        # Causal mask: prevent attending to future timesteps
        causal_mask = nn.Transformer.generate_square_subsequent_mask(T, device=x.device)
        h = self.encoder(h, mask=causal_mask)     # (B, T, d_model)

        # Use last timestep for prediction
        last = h[:, -1, :]                         # (B, d_model)

        looking_logit = self.head_looking(last).squeeze(-1)     # (B,)
        aversion_logits = self.head_aversion(last)              # (B, 6)
        duration = self.head_duration(last).squeeze(-1)         # (B,)

        return GazePrediction(
            looking_logit=looking_logit,
            aversion_logits=aversion_logits,
            duration=duration,
        )

    def predict(self, x: torch.Tensor) -> dict[str, torch.Tensor]:
        """Inference-friendly prediction with activated outputs.

        Returns:
            Dict with:
              - looking_prob: (B,) sigmoid probability
              - aversion_probs: (B, 6) softmax probabilities
              - duration_norm: (B,) normalized duration [0, 1]
        """
        self.eval()
        with torch.no_grad():
            pred = self.forward(x)
        return {
            "looking_prob": torch.sigmoid(pred.looking_logit),
            "aversion_probs": F.softmax(pred.aversion_logits, dim=-1),
            "duration_norm": pred.duration,
        }


class GazeLoss(nn.Module):
    """Combined loss for the three prediction heads.

    Loss = w_bce * BCE(looking) + w_ce * CE(aversion) + w_mse * MSE(duration)

    The aversion loss is masked to only apply when the target indicates
    the avatar is NOT looking at the user (aversion is meaningless when
    the avatar is maintaining eye contact).
    """

    def __init__(
        self,
        w_bce: float = 1.0,
        w_ce: float = 1.0,
        w_mse: float = 0.5,
    ) -> None:
        super().__init__()
        self.w_bce = w_bce
        self.w_ce = w_ce
        self.w_mse = w_mse
        self.bce = nn.BCEWithLogitsLoss()
        self.ce = nn.CrossEntropyLoss(reduction="none")
        self.mse = nn.MSELoss()

    def forward(
        self,
        pred: GazePrediction,
        targets: torch.Tensor,
    ) -> tuple[torch.Tensor, dict[str, float]]:
        """Compute combined loss.

        Args:
            pred: GazePrediction from model.
            targets: (B, 8) — [looking(1), aversion_oh(6), duration_norm(1)]

        Returns:
            (total_loss, component_dict) for logging.
        """
        target_looking = targets[:, 0]                          # (B,)
        target_aversion = targets[:, 1:7].argmax(dim=-1)        # (B,) class index
        target_duration = targets[:, 7]                         # (B,)

        # 1. Binary: should avatar look at user?
        loss_bce = self.bce(pred.looking_logit, target_looking)

        # 2. Categorical: aversion direction (masked when looking)
        not_looking_mask = (target_looking < 0.5).float()        # 1.0 when averting
        loss_ce_per_sample = self.ce(pred.aversion_logits, target_aversion)
        if not_looking_mask.sum() > 0:
            loss_ce = (loss_ce_per_sample * not_looking_mask).sum() / not_looking_mask.sum().clamp(min=1.0)
        else:
            loss_ce = torch.tensor(0.0, device=pred.looking_logit.device)

        # 3. Regression: contact duration
        loss_mse = self.mse(pred.duration, target_duration)

        total = self.w_bce * loss_bce + self.w_ce * loss_ce + self.w_mse * loss_mse

        components = {
            "loss_bce": loss_bce.item(),
            "loss_ce": loss_ce.item(),
            "loss_mse": loss_mse.item(),
            "loss_total": total.item(),
        }
        return total, components


def count_parameters(model: nn.Module) -> int:
    """Return total trainable parameter count."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


if __name__ == "__main__":
    # Quick shape/param check
    model = GazeTransformer()
    n_params = count_parameters(model)
    print(f"GazeTransformer: {n_params:,} trainable parameters")

    # Dummy forward pass
    batch = torch.randn(4, 32, INPUT_DIM)
    pred = model(batch)
    print(f"  looking_logit:   {pred.looking_logit.shape}")
    print(f"  aversion_logits: {pred.aversion_logits.shape}")
    print(f"  duration:        {pred.duration.shape}")

    # Loss check
    targets = torch.randn(4, 8).abs()
    targets[:, 0] = (targets[:, 0] > 0.5).float()
    criterion = GazeLoss()
    loss, comps = criterion(pred, targets)
    print(f"  loss: {loss.item():.4f}  components: {comps}")
    print("Self-test passed.")
