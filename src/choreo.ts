export type CameraAxis = '⊙' | '→' | '←' | '↑' | '↓' | '↔';
export type CameraZoom = '🔍' | '👁️' | '🌌';
export type KineticFX = 'none' | '⚖️' | '🐍' | '🧮';

export interface ChoreoInstruction {
  axis: CameraAxis;
  zoom: CameraZoom;
  fx: KineticFX;
  match: string;
}

/**
 * ATOMIC SIDELOADED SHIM (The Director's Script)
 * 
 * WYSIWYG SPATIAL GRAPH
 * This layout physically maps the 2D plane. 
 * Indentation and line breaks represent spatial relationships.
 * 
 * Legend:
 * [AXIS] ⊙ = Hold, → = Right, ↓ = Down, ↔ = Split Scale
 * [ZOOM] 🔍 = Tight, 👁️ = Medium, 🌌 = Fit Group (Responsive)
 * [ FX ] none = Default, ⚖️ = Seesaw, 🐍 = Snake, 🧮 = Macro Math
 */
const WYSIWYG_SCRIPT = `
[⊙ 👁️ none] look at the board
    [→ 👁️ none] break it down
        [↓ 👁️ none] make you frown
            [→ 👁️ none] X or a Y
            [⊙ 🔍 none] middle of the math
                [↓ 🔍 none] hidden number
                    [→ 👁️ none] mystery inside
                        [↓ 👁️ none] party trying to hide
                            [→ 👁️ none] goal of the game
                                [↓ 🔍 none] leave it alone
                                    [→ 🔍 none] isolate the letter
                                    [⊙ 🔍 none] throne

[↔ 👁️ ⚖️] left of the sign                        [↔ 👁️ ⚖️] to the right
                        [↓ 👁️ ⚖️] about balance
                        [↓ 🔍 ⚖️] golden rule

                                                                            [→ 🔍 🐍] Find the X
                                                                                [→ 🔍 🐍] solve the unknown
                                                                                    [→ 🔍 🐍] Step by step
                                                                                        [→ 🔍 🐍] answer is shown

                                                                                        [⊙ 🌌 🧮] X plus four

[↔ 👁️ ⚖️] Whatever you do to the left             [↔ 👁️ ⚖️] Do it to the right
                        [↓ 👁️ ⚖️] keeping the scale
                        [↓ 🔍 ⚖️] never fail
`.trim();

export const DIRECTOR_SCRIPT: ChoreoInstruction[] = [];
WYSIWYG_SCRIPT.split('\n').forEach(line => {
  const regex = /\[(.*?)\s+(.*?)\s+(.*?)\]\s+([^\[]*)/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    DIRECTOR_SCRIPT.push({
      axis: match[1] as CameraAxis,
      zoom: match[2] as CameraZoom,
      fx: match[3] as KineticFX,
      match: match[4].trim()
    });
  }
});

export function getChoreoInstruction(text: string): ChoreoInstruction | null {
  const t = text.toLowerCase();
  for (const block of DIRECTOR_SCRIPT) {
    if (t.includes(block.match.toLowerCase())) {
      return block;
    }
  }
  return null;
}
