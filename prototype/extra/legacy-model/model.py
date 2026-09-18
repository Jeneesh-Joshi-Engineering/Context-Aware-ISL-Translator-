"""Legacy Keras BiLSTM architecture placeholder."""
from __future__ import annotations

from config import DENSE_UNITS, DROPOUT_RATE, LSTM_UNITS_1, LSTM_UNITS_2


def build_model(max_frames: int, num_features: int, num_classes: int):
    """Build the requested default BiLSTM classifier architecture."""
    from tensorflow.keras import Sequential
    from tensorflow.keras.layers import Bidirectional, Dense, Dropout, Input, LSTM
    model = Sequential([
        Input(shape=(max_frames, num_features)),
        Bidirectional(LSTM(LSTM_UNITS_1, return_sequences=True)),
        Dropout(DROPOUT_RATE),
        Bidirectional(LSTM(LSTM_UNITS_2)),
        Dropout(DROPOUT_RATE),
        Dense(DENSE_UNITS, activation="relu"),
        Dense(num_classes, activation="softmax"),
    ])
    model.compile(optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"])
    model.summary()
    return model
