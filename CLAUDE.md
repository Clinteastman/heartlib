# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HeartMuLa is a family of open-source music foundation models:
- **HeartMuLa**: Music language model that generates music from lyrics and tags (multilingual: English, Chinese, Japanese, Korean, Spanish)
- **HeartCodec**: 12.5 Hz music codec with high reconstruction fidelity
- **HeartTranscriptor**: Whisper-based model for lyrics transcription

## Commands

```bash
# Install (Python 3.10 recommended)
pip install -e .

# Generate music
python ./examples/run_music_generation.py --model_path=./ckpt --version="3B"

# Transcribe lyrics
python ./examples/run_lyrics_transcription.py --model_path=./ckpt
```

## Architecture

The library follows the Hugging Face transformers pipeline pattern. All models extend `PreTrainedModel`.

### Source Structure
```
src/heartlib/
├── pipelines/           # High-level pipeline interfaces
│   ├── music_generation.py    # HeartMuLaGenPipeline
│   └── lyrics_transcription.py # HeartTranscriptorPipeline
├── heartmula/           # Music language model
│   ├── modeling_heartmula.py  # LLaMA-3.2 based transformer (3B/7B variants)
│   └── configuration_heartmula.py
└── heartcodec/          # Audio codec
    ├── modeling_heartcodec.py # Combines flow matching + scalar codec
    ├── models/
    │   ├── flow_matching.py   # Flow matching decoder
    │   ├── sq_codec.py        # Scalar quantization codec
    │   └── transformer.py     # Transformer blocks
    └── configuration_heartcodec.py
```

### Key Design Patterns

1. **HeartMuLa Model**: Uses torchtune's LLaMA-3.2 architecture. Has a backbone transformer for processing text/audio embeddings and a decoder for generating audio codebook tokens. Supports classifier-free guidance via `cfg_scale`.

2. **HeartCodec Model**: Two-stage architecture:
   - `ScalarModel`: Encodes/decodes raw audio to/from latent space
   - `FlowMatching`: Converts between discrete tokens and latent representations

3. **Pipelines**: Follow HuggingFace's `preprocess -> _forward -> postprocess` pattern. Load models via `from_pretrained(path, device, dtype)`.

### Checkpoint Structure
```
./ckpt/
├── HeartCodec-oss/
├── HeartMuLa-oss-3B/
├── gen_config.json
└── tokenizer.json
```

Download checkpoints with:
```bash
hf download --local-dir './ckpt/HeartMuLa-oss-3B' 'HeartMuLa/HeartMuLa-oss-3B'
hf download --local-dir './ckpt/HeartCodec-oss' 'HeartMuLa/HeartCodec-oss'
```
