"""Data loading and encoding for conversational gaze behavior training.

Loads JSONL gaze behavior data (from HuggingFace datasets or local files),
encodes categorical/continuous features into tensors, and produces windowed
sequences for the GazeTransformer.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset

# ---------------------------------------------------------------------------
# Schema constants — keep in sync with Rust enums in gaze.rs / culture.rs
# ---------------------------------------------------------------------------

CONVERSATION_STATES: list[str] = ["idle", "listening", "thinking", "speaking"]
USER_GAZE_ZONES: list[str] = ["at_me", "away", "down"]
CULTURES: list[str] = ["western", "east_asian", "middle_eastern", "south_asian"]
SPEAKER_ROLES: list[str] = ["avatar", "user"]

# AversionDirection — 6-way categorical matching Rust enum order
AVERSION_DIRECTIONS: list[str] = [
    "up_right",
    "up_left",
    "right",
    "left",
    "down_right",
    "down_left",
]

# Feature dimensions after encoding
NUM_CONV_STATES = len(CONVERSATION_STATES)        # 4
NUM_GAZE_ZONES = len(USER_GAZE_ZONES)             # 3
NUM_CULTURES = len(CULTURES)                       # 4
NUM_AVERSION_DIRS = len(AVERSION_DIRECTIONS)       # 6
# speaker_role(1) + contact_duration_norm(1) + time_delta_norm(1) = 3 continuous
CONTINUOUS_DIM = 3
INPUT_DIM = NUM_CONV_STATES + NUM_GAZE_ZONES + NUM_CULTURES + CONTINUOUS_DIM  # 14

# Maximum contact duration for normalization (ms).  Rust uses ~4s max.
MAX_CONTACT_DURATION_MS: float = 6000.0
# Maximum inter-sample time delta for normalization (ms).
MAX_TIME_DELTA_MS: float = 2000.0


@dataclass
class GazeSample:
    """Single row from the gaze behavior dataset."""

    timestamp_ms: int
    conversation_id: str
    speaker_role: str
    conversation_state: str
    user_gaze_zone: str
    avatar_looking_at_user: bool
    aversion_direction: str
    contact_duration_ms: float
    culture: str
    transcript_segment: str


def _one_hot(index: int, size: int) -> np.ndarray:
    """Return a one-hot vector of length *size* with 1.0 at *index*."""
    vec = np.zeros(size, dtype=np.float32)
    if 0 <= index < size:
        vec[index] = 1.0
    return vec


def encode_row(row: dict) -> tuple[np.ndarray, np.ndarray]:
    """Encode a single JSONL row into (input_features, targets).

    Returns:
        features: float32 array of shape (INPUT_DIM,)
        targets:  float32 array of shape (8,)
                  [looking_at_user,
                   aversion_dir_one_hot (6),
                   contact_duration_norm]
    """
    # --- Input features ---
    conv_state = _one_hot(
        CONVERSATION_STATES.index(row["conversation_state"]),
        NUM_CONV_STATES,
    )
    gaze_zone = _one_hot(
        USER_GAZE_ZONES.index(row["user_gaze_zone"]),
        NUM_GAZE_ZONES,
    )
    culture = _one_hot(
        CULTURES.index(row["culture"]),
        NUM_CULTURES,
    )
    speaker = np.array(
        [1.0 if row["speaker_role"] == "avatar" else 0.0],
        dtype=np.float32,
    )
    duration_norm = np.array(
        [min(row["contact_duration_ms"] / MAX_CONTACT_DURATION_MS, 1.0)],
        dtype=np.float32,
    )
    # time_delta is computed at the sequence level — placeholder zero here
    time_delta = np.array([0.0], dtype=np.float32)

    features = np.concatenate([
        conv_state,
        gaze_zone,
        culture,
        speaker,
        duration_norm,
        time_delta,
    ])
    assert features.shape == (INPUT_DIM,), f"Expected {INPUT_DIM}, got {features.shape}"

    # --- Targets ---
    looking = np.array(
        [1.0 if row["avatar_looking_at_user"] else 0.0],
        dtype=np.float32,
    )
    aversion = row.get("aversion_direction", "down_left") or "down_left"
    aversion_oh = _one_hot(
        AVERSION_DIRECTIONS.index(aversion),
        NUM_AVERSION_DIRS,
    )
    target_duration = np.array(
        [row["contact_duration_ms"] / MAX_CONTACT_DURATION_MS],
        dtype=np.float32,
    )
    targets = np.concatenate([looking, aversion_oh, target_duration])
    return features, targets


def load_jsonl(path: Path) -> list[dict]:
    """Load a JSONL file into a list of dicts."""
    rows: list[dict] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def load_dataframe(path: Path) -> pd.DataFrame:
    """Load gaze data from JSONL or CSV into a DataFrame."""
    suffix = path.suffix.lower()
    if suffix == ".jsonl":
        return pd.DataFrame(load_jsonl(path))
    elif suffix == ".csv":
        return pd.read_csv(path)
    else:
        raise ValueError(f"Unsupported file format: {suffix}")


class GazeSequenceDataset(Dataset):
    """Windowed sequence dataset for GazeTransformer training.

    Each item is a (seq_len, INPUT_DIM) input tensor and a (8,) target tensor
    corresponding to the *last* timestep's prediction target.  The time_delta
    feature (last element of each timestep's feature vector) is filled with
    the normalized inter-sample gap.

    Args:
        data_path: Path to a JSONL or CSV file.
        seq_len:   Number of past timesteps to include per sample.
        stride:    Step size between consecutive windows within a conversation.
    """

    def __init__(
        self,
        data_path: str | Path,
        seq_len: int = 32,
        stride: int = 1,
    ) -> None:
        super().__init__()
        self.seq_len = seq_len
        self.stride = stride

        df = load_dataframe(Path(data_path))
        # Sort by conversation then timestamp
        df = df.sort_values(["conversation_id", "timestamp_ms"]).reset_index(drop=True)

        self._build_sequences(df)

    def _build_sequences(self, df: pd.DataFrame) -> None:
        """Pre-encode all rows and build sliding-window indices."""
        # Encode every row
        all_features: list[np.ndarray] = []
        all_targets: list[np.ndarray] = []
        conversation_ids: list[str] = []
        timestamps: list[int] = []

        for _, row in df.iterrows():
            feat, tgt = encode_row(row.to_dict())
            all_features.append(feat)
            all_targets.append(tgt)
            conversation_ids.append(row["conversation_id"])
            timestamps.append(int(row["timestamp_ms"]))

        self._features = np.stack(all_features)  # (N, INPUT_DIM)
        self._targets = np.stack(all_targets)      # (N, 8)
        self._conv_ids = conversation_ids
        self._timestamps = np.array(timestamps, dtype=np.int64)

        # Build per-conversation contiguous index ranges
        self._windows: list[tuple[int, int]] = []  # (start, end) end exclusive
        conv_start = 0
        for i in range(1, len(conversation_ids) + 1):
            if i == len(conversation_ids) or conversation_ids[i] != conversation_ids[conv_start]:
                conv_len = i - conv_start
                if conv_len >= self.seq_len:
                    for w_start in range(conv_start, conv_start + conv_len - self.seq_len + 1, self.stride):
                        w_end = w_start + self.seq_len
                        self._windows.append((w_start, w_end))
                conv_start = i

    def __len__(self) -> int:
        return len(self._windows)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        start, end = self._windows[idx]

        features = self._features[start:end].copy()  # (seq_len, INPUT_DIM)
        targets = self._targets[end - 1]              # (8,) last step's target

        # Fill in time_delta for each timestep (last feature column)
        ts = self._timestamps[start:end]
        deltas = np.zeros(self.seq_len, dtype=np.float32)
        deltas[1:] = np.clip(
            (ts[1:] - ts[:-1]).astype(np.float32) / MAX_TIME_DELTA_MS,
            0.0,
            1.0,
        )
        features[:, -1] = deltas

        return (
            torch.from_numpy(features),
            torch.from_numpy(targets),
        )


def create_synthetic_dataset(
    path: Path,
    num_conversations: int = 50,
    samples_per_conversation: int = 200,
    seed: int = 42,
) -> Path:
    """Generate a synthetic JSONL dataset for testing the pipeline.

    Produces gaze patterns that loosely follow the Rust state machine's
    behavior distributions so the model has something meaningful to learn.
    """
    rng = np.random.default_rng(seed)
    rows: list[dict] = []

    for conv_idx in range(num_conversations):
        conv_id = f"conv_{conv_idx:04d}"
        culture = rng.choice(CULTURES)
        ts = 0

        # Rough gaze ratios per culture (mirroring CultureProfile)
        ratios = {
            "western":        0.65,
            "east_asian":     0.45,
            "middle_eastern": 0.75,
            "south_asian":    0.50,
        }
        look_prob = ratios[culture]
        state = rng.choice(CONVERSATION_STATES)

        for step in range(samples_per_conversation):
            # Occasionally switch state
            if rng.random() < 0.05:
                state = rng.choice(CONVERSATION_STATES)

            # Adjust looking probability by state
            state_mod = {
                "idle": -0.15,
                "listening": 0.10,
                "thinking": -0.20,
                "speaking": 0.0,
            }
            p = np.clip(look_prob + state_mod[state], 0.1, 0.95)
            looking = bool(rng.random() < p)

            speaker = "avatar" if state in ("speaking", "thinking") else "user"
            gaze_zone = rng.choice(USER_GAZE_ZONES, p=[0.5, 0.3, 0.2])
            aversion = rng.choice(AVERSION_DIRECTIONS) if not looking else "down_left"

            # Duration: 200-4000ms depending on culture and looking state
            base_dur = rng.uniform(200, 3500) if looking else rng.uniform(200, 1500)
            contact_dur = float(base_dur)

            dt = int(rng.uniform(16, 100))  # 10-60 Hz sampling
            ts += dt

            rows.append({
                "timestamp_ms": ts,
                "conversation_id": conv_id,
                "speaker_role": speaker,
                "conversation_state": state,
                "user_gaze_zone": gaze_zone,
                "avatar_looking_at_user": looking,
                "aversion_direction": aversion,
                "contact_duration_ms": contact_dur,
                "culture": culture,
                "transcript_segment": "",
            })

    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")

    return path


if __name__ == "__main__":
    # Quick self-test: generate synthetic data and verify dataset loads
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "test.jsonl"
        create_synthetic_dataset(p, num_conversations=5, samples_per_conversation=100)
        ds = GazeSequenceDataset(p, seq_len=16, stride=4)
        print(f"Dataset: {len(ds)} windows")
        if len(ds) > 0:
            feat, tgt = ds[0]
            print(f"  features: {feat.shape}  targets: {tgt.shape}")
            assert feat.shape == (16, INPUT_DIM)
            assert tgt.shape == (8,)
        print("Self-test passed.")
