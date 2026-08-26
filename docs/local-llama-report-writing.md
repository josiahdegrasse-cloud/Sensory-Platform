# Local Llama report writing

Commercialization-report prose is written on the administrator's device with
WebLLM and a quantized Llama 3.2 instruct model. The report-writing prompt and
generated prose are not sent to OpenAI or the remote research API.

## Execution flow

1. Existing deterministic code builds the canonical `ReportContext`.
2. `buildLocalReportWriterPacket` creates a bounded, report-safe packet.
3. A module Web Worker downloads or restores the selected Llama model and
   generates five structured report sections.
4. The existing PDF renderer applies those sections to the report snapshot.
5. `runQcPipeline` checks evidence, calculations, decision language, claims,
   limitations, and client-facing copy.
6. Repairable findings can trigger up to two focused Local Llama rewrites.
7. The report snapshot stores the model, token counts, correction count,
   execution location, and zero external model cost.

## Models

- Llama 3.2 3B Instruct q4f16: default quality option, about 2.3 GB VRAM.
- Llama 3.2 1B Instruct q4f16: lower-memory option, about 0.9 GB VRAM.

Model weights and WebGPU libraries are loaded from the WebLLM project's
published Hugging Face and GitHub assets and cached in the browser.

## Fallback and failure boundaries

If WebGPU is unavailable, the model cannot load, or generation is cancelled, no
report is saved. The user can retry, select the smaller model, or use another
compatible device.

If the model returns missing, short, or malformed sections, the writer replaces
only those sections with evidence-bounded deterministic copy and records a
warning. Deterministic QC still evaluates the complete report; critical findings
block approval and export.
