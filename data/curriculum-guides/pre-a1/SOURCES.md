# Pre-A1 curriculum guide — sources & licence matrix

Hybrid licensing stance (ADR 0047): Lang-Tutor owns the runtime syllabus spine.
External frameworks are **cite + short approved paraphrase/excerpt** only — never a
full commercial corpus dump.

| Asset           | Provenance                                                                        | Licence / reuse posture                 | Notes                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `spine.json`    | Lang-Tutor authored                                                               | Proprietary to Lang-Tutor (product SoT) | Oriented by Starters skill families + L&S-style runway; original text.                                                            |
| `phonics.json`  | Lang-Tutor distillation of public pedagogical structure from _Letters and Sounds_ | Distillation + attribution (see below)  | Not a republication of the PDF. Phase ladder rewritten in our words.                                                              |
| `excerpts.json` | Lang-Tutor paraphrases citing Cambridge Pre A1 Starters / CEFR framing            | Original paraphrase; cite only          | **No** Cambridge handbook or CoE handbook verbatim text. HITL must approve any future verbatim third-party excerpt before commit. |
| This file       | Lang-Tutor                                                                        | Same as repo docs                       | Audit trail for agents and humans.                                                                                                |

## Letters and Sounds (phonics distillation)

- **Title:** Letters and Sounds: Principles and Practice of High Quality Phonics
- **Publisher:** Department for Education and Skills (UK), 2007
- **Ref:** DFES-00281-2007
- **Publication page:** https://www.gov.uk/government/publications/letters-and-sounds
- **PDF:** https://assets.publishing.service.gov.uk/media/5a7aa7b6e5274a34770e630c/Letters_and_Sounds_-_DFES-00281-2007.pdf
- **Copyright notice on the 2007 PDF:** Crown copyright 2007. Schools and local
  authorities may reproduce free of charge if the material is acknowledged as Crown
  copyright, the publication title is specified, reproduction is accurate, and it is
  not used in a misleading context. Other reusers were directed to apply to OPSI for
  a core licence. Third-party material inside the PDF is excluded.
- **GOV.UK / OGL note:** Modern GOV.UK content is typically published under the
  [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
  The 2007 PDF itself carries the older Crown reuse notice above. **HITL must confirm
  the exact reuse terms that apply to any future verbatim PDF excerpts before ship.**
- **What we bundle today:** a short Lang-Tutor-authored phase ladder (oral awareness →
  early GPCs → gentle blending) with attribution — not the full handbook, word banks,
  or activity scripts from the PDF.

## Cambridge Pre A1 Starters

- **Role:** pedagogical north star for YLE / early-years skill families (alphabet,
  phonics-adjacent, picture vocabulary, listening recognition).
- **What we bundle:** short Lang-Tutor paraphrases of skill intent only.
- **What we do not bundle:** Cambridge Assessment English wordlists, handbook PDFs,
  sample papers, or commercial activity banks.

## CEFR / Council of Europe Pre-A1 framing

- **Role:** optional level framing for “below A1 / breakthrough foundations.”
- **What we bundle:** a short original paraphrase of the idea of pre-A1 foundations.
- **What we do not bundle:** CoE CEFR Companion Volume tables or long descriptor lists.

## Policy for future edits

1. Prefer original Lang-Tutor text constrained by the spine.
2. Keep any third-party excerpt short, attributed, and human-approved before commit.
3. Never commit full commercial wordlists or handbooks.
4. Update this matrix in the same PR as any new third-party text.
