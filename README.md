# Chesscribe

Turn a photo of a handwritten chess scoresheet into a PGN, entirely in the browser.

Chesscribe detects the move grid on a scoresheet, crops each handwritten move, runs
OCR with either an on-device model or Gemini cloud OCR, and lets you review and correct
the result on a live board before exporting.

## Features

- Camera capture or image upload
- Automatic scoresheet grid detection with manual crop adjustment
- Selectable OCR engine: private on-device model or Gemini cloud OCR
- Move-by-move review with a chessboard preview and legal-move validation
- Drag pieces on the board to add or replace moves and update the PGN live
- Automatic cleanup of common notation quirks (`0-0`, `:`, spacing)
- PGN export with optional player names, Elo ratings, and result
- Copy PGN, download a `.pgn` file, or open the game on Lichess

## How it works

1. **Capture** — take a photo or choose an image.
2. **Crop** — the app finds the scoresheet grid; adjust the crop if needed.
3. **Recognize** — use the local BiLSTM model through `onnxruntime-web`, or send the
   cropped scoresheet to Gemini for cloud OCR.
4. **Review** — correct any misread moves by typing or by dragging pieces on the
   board. The current move is highlighted, and illegal or ambiguous moves are marked
   red with live updates.
5. **Export** — copy or download the PGN, or send the moves to Lichess analysis.

## OCR engines

**Local model** — private and offline after the first download. Each move cell is
preprocessed and classified by a BiLSTM model running through `onnxruntime-web`. The
model is downloaded once from Hugging Face and cached in the browser's Cache Storage.

**Gemini (cloud)** — helpful for scoresheets with timestamps or other annotations that
confuse the local model. Choose Gemini on the capture or review screen and paste a
[free Google AI Studio API key](https://aistudio.google.com/app/apikey). The key is
stored in this browser, and only the cropped scoresheet is sent to Google.

With the local model, photos and recognized moves stay on the device.

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
  ocr.ts                 Local ONNX model loading and handwriting recognition
  cloudOcr.ts            Gemini cloud OCR request and response parsing
  components/            Capture, crop, board, move grid, review, export UI
public/fixtures/         Sample scoresheet image
```

## Tech stack

React 19, TypeScript, Vite, `chess.js`, `react-chessboard`,
`react-image-crop`, and `onnxruntime-web`.
