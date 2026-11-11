# Chesscribe

Turn a photo of a handwritten chess scoresheet into a PGN, entirely in the browser.

Chesscribe detects the move grid on a scoresheet, crops each handwritten move, runs
on-device OCR with an ONNX handwriting model, and lets you review and correct the
result on a live board before exporting.

## Features

- Camera capture or image upload
- Automatic scoresheet grid detection with manual crop adjustment
- On-device handwriting recognition (WASM, no server round-trip)
- Move-by-move review with a chessboard preview and legal-move validation
- Automatic cleanup of common notation quirks (`0-0`, `:`, spacing)
- PGN export with optional player names, Elo ratings, and result
- Copy PGN, download a `.pgn` file, or open the game on Lichess

## How it works

1. **Capture** — take a photo or choose an image.
2. **Crop** — the app finds the scoresheet grid; adjust the crop if needed.
3. **Recognize** — each move cell is preprocessed and classified by a BiLSTM OCR
   model running through `onnxruntime-web`.
4. **Review** — correct any misread moves. Illegal moves are highlighted, and the
   board follows the selected move.
5. **Export** — copy or download the PGN, or send the moves to Lichess analysis.

The recognition model is downloaded once from Hugging Face and cached in the
browser's Cache Storage. Photos and recognized moves stay on the device.

## Getting started

Requirements: Node.js and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm dev
```

Open the printed local URL. A sample scoresheet is available at
`public/fixtures/marshall-scoresheet.jpg`.

## Scripts

| Command           | Description                              |
| ----------------- | ---------------------------------------- |
| `pnpm dev`        | Start the Vite development server        |
| `pnpm build`      | Type-check and build for production      |
| `pnpm preview`    | Preview the production build             |
| `pnpm test`       | Run the Vitest test suite                |
| `pnpm typecheck`  | Run the TypeScript compiler with no emit |

## Project structure

```text
src/
  App.tsx                Capture → crop → review workflow
  game.ts                Move normalization, validation, PGN and Lichess export
  grid.ts                Scoresheet grid detection and image preprocessing
  ocr.ts                 Model loading and ONNX handwriting recognition
  components/            Capture, crop, board, move grid, review, export UI
public/fixtures/         Sample scoresheet image
```

## Tech stack

React 19, TypeScript, Vite, `chess.js`, `react-chessboard`,
`react-image-crop`, and `onnxruntime-web`.
