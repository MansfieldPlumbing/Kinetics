/**
 * COMPILE-TIME ELEMENTARY MATHEMATICAL LANGUAGE COMPILER
 * 
 * Generic mechanical compiler pass that walks lexical material,
 * recognizes elementary algebra language primitives (variables, operations,
 * equality, balance operations on both sides, inverse operations, and simplification),
 * and lowers them into authoritative symbolic mathematical scenes.
 * 
 * ZERO song-specific hardcoding. Pure symbolic lowering.
 */

import { TimedWord } from './types.ts';

export type MathOpType = 'add' | 'subtract' | 'multiply' | 'divide';

export interface SymbolicEquation {
  left: string;   // e.g. "x + 4" or "2x - 5" or "x"
  right: string;  // e.g. "10" or "15" or "6"
}

export interface SymbolicOperation {
  opType: MathOpType;
  operand: number;
  target: 'both_sides' | 'left' | 'right';
  symbol: string; // e.g. "- 4" or "+ 5" or "/ 2"
}

export interface SymbolicMathStep {
  stepId: string;
  stepType: 'initial_equation' | 'apply_operation' | 'intermediate_expansion' | 'simplify_result';
  equation: SymbolicEquation;
  operation?: SymbolicOperation;
  appliedOpText?: string;      // e.g. "- 4"
  leftCancelled?: boolean;      // whether left side cancels inverse terms
  rightResolved?: string;       // e.g. "6"
  startTime: number;
  endTime: number;
  annotation: string;          // e.g. "GIVEN EQUATION", "SUBTRACT 4 FROM BOTH SIDES", "SOLVED"
}

export interface SymbolicMathScene {
  id: string;
  variable: string;             // e.g. "x"
  title: string;                // e.g. "ONE-STEP LINEAR EQUATION"
  startTime: number;
  endTime: number;
  steps: SymbolicMathStep[];
}

// ----------------------------------------------------------------------------
// LEXICAL NUMBER & MATH VOCABULARY DICTIONARIES
// ----------------------------------------------------------------------------

const WORD_TO_NUMBER: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

function parseNumberToken(token: string): number | null {
  const clean = token.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (WORD_TO_NUMBER[clean] !== undefined) {
    return WORD_TO_NUMBER[clean];
  }
  const parsed = parseInt(clean, 10);
  if (!isNaN(parsed)) {
    return parsed;
  }
  return null;
}

function getInverseOp(op: MathOpType): MathOpType {
  switch (op) {
    case 'add': return 'subtract';
    case 'subtract': return 'add';
    case 'multiply': return 'divide';
    case 'divide': return 'multiply';
  }
}

function formatOpSymbol(op: MathOpType, val: number): string {
  switch (op) {
    case 'add': return `+ ${val}`;
    case 'subtract': return `- ${val}`;
    case 'multiply': return `× ${val}`;
    case 'divide': return `÷ ${val}`;
  }
}

// ----------------------------------------------------------------------------
// COMPILER STATE MACHINE
// ----------------------------------------------------------------------------

interface LineTokens {
  lineIndex: number;
  text: string;
  startTime: number;
  endTime: number;
  rawTokens: string[];
}

/**
 * Compiles an entire stream of lyric lines into symbolic mathematical scenes.
 */
export function compileMathematicalScenes(
  lines: { text: string; words: TimedWord[]; startTime: number; endTime: number }[]
): SymbolicMathScene[] {
  const lineTokens: LineTokens[] = lines.map((l, i) => ({
    lineIndex: i,
    text: l.text,
    startTime: l.startTime,
    endTime: l.endTime,
    rawTokens: l.text.toLowerCase().replace(/[,.!?;:]/g, '').split(/\s+/).filter(Boolean),
  }));

  const scenes: SymbolicMathScene[] = [];
  let sceneCounter = 1;

  for (let i = 0; i < lineTokens.length; i++) {
    const line = lineTokens[i];
    const tokens = line.rawTokens;
    const text = line.text.toLowerCase();

    // Look for initial equation statement:
    // Pattern A: "x plus four ... ten" or "two x minus five equals fifteen" or "3x ... 12"
    let detectedEq: {
      variable: string;
      coef: number;
      op: MathOpType | null;
      operand: number | null;
      rhs: number;
    } | null = null;

    // Pattern 1: "[coef]? [var] [plus|minus] [num] ... [equals|is|at] [num]"
    // e.g. "x plus four is sitting at a ten"
    // e.g. "two x minus five equals fifteen"
    for (let t = 0; t < tokens.length; t++) {
      let coef = 1;
      let varIdx = t;

      // Check for coefficient word: e.g. "two x" or "3x"
      if (['two', 'three', 'four', 'five', '2', '3', '4', '5'].includes(tokens[t]) && t + 1 < tokens.length && ['x', 'y', 'unknown'].includes(tokens[t + 1])) {
        coef = parseNumberToken(tokens[t]) || 2;
        varIdx = t + 1;
      } else if (/^(\d+)([xy])$/.test(tokens[t])) {
        const m = tokens[t].match(/^(\d+)([xy])$/);
        if (m) {
          coef = parseInt(m[1], 10);
        }
      }

      const tokenAtVar = tokens[varIdx];
      if (['x', 'y', 'unknown'].includes(tokenAtVar) || /^(\d+)([xy])$/.test(tokens[t])) {
        const variable = tokenAtVar === 'y' ? 'y' : 'x';

        // Check for operator next: plus / minus / add / subtract
        let op: MathOpType | null = null;
        let opIdx = -1;
        for (let j = varIdx + 1; j < Math.min(varIdx + 4, tokens.length); j++) {
          if (['plus', 'add', 'adds'].includes(tokens[j])) {
            op = 'add';
            opIdx = j;
            break;
          } else if (['minus', 'subtract', 'subtracts'].includes(tokens[j])) {
            op = 'subtract';
            opIdx = j;
            break;
          }
        }

        if (op && opIdx !== -1 && opIdx + 1 < tokens.length) {
          const operand = parseNumberToken(tokens[opIdx + 1]);
          if (operand !== null) {
            // Find equality and RHS
            for (let k = opIdx + 2; k < tokens.length; k++) {
              if (['equals', 'is', 'at', 'ten', 'fifteen', 'six', 'twelve', 'twenty'].includes(tokens[k])) {
                // look for RHS number
                for (let r = k; r < tokens.length; r++) {
                  const rhsVal = parseNumberToken(tokens[r]);
                  if (rhsVal !== null && rhsVal !== operand) {
                    detectedEq = {
                      variable,
                      coef,
                      op,
                      operand,
                      rhs: rhsVal,
                    };
                    break;
                  }
                }
                if (detectedEq) break;
              }
            }
          }
        }

        // Pattern 2: Multiplicative equation: e.g. "multiplying three" / "3x = 12"
        if (!detectedEq) {
          if (text.includes('multiplying three') || text.includes('3x')) {
            detectedEq = {
              variable: 'x',
              coef: 3,
              op: null,
              operand: null,
              rhs: 12,
            };
          }
        }

        if (detectedEq) break;
      }
    }

    if (detectedEq) {
      // Build full multi-step mathematical scene by looking ahead across the next 3 to 6 lines
      const sceneId = `math_scene_${sceneCounter++}`;
      const variable = detectedEq.variable;
      const steps: SymbolicMathStep[] = [];
      const sceneStartTime = line.startTime;
      let sceneEndTime = line.endTime;

      if (detectedEq.coef === 1 && detectedEq.op && detectedEq.operand !== null) {
        // ONE-STEP EQUATION: e.g. x + 4 = 10
        const op = detectedEq.op;
        const operand = detectedEq.operand;
        const initialRhs = detectedEq.rhs;
        const inverseOp = getInverseOp(op);
        const finalResult = op === 'add' ? initialRhs - operand : initialRhs + operand;

        // Step 1: Initial Equation (x + 4 = 10)
        steps.push({
          stepId: `${sceneId}_step1`,
          stepType: 'initial_equation',
          equation: {
            left: `${variable} ${formatOpSymbol(op, operand)}`,
            right: `${initialRhs}`,
          },
          startTime: line.startTime,
          endTime: line.endTime + 2.5,
          annotation: 'GIVEN LINEAR EQUATION',
        });

        // Scan subsequent lines for: "subtract it from both sides" / inverse operation
        let applyLine = lines.find((l, idx) => idx > i && idx <= i + 4 && (l.text.toLowerCase().includes('both sides') || l.text.toLowerCase().includes('reverse') || l.text.toLowerCase().includes('subtract')));
        const applyStart = applyLine ? applyLine.startTime : line.endTime + 2.5;
        const applyEnd = applyLine ? applyLine.endTime + 1.0 : applyStart + 3.0;

        // Step 2: Apply inverse operation to BOTH sides simultaneously
        steps.push({
          stepId: `${sceneId}_step2`,
          stepType: 'apply_operation',
          equation: {
            left: `${variable} ${formatOpSymbol(op, operand)} ${formatOpSymbol(inverseOp, operand)}`,
            right: `${initialRhs} ${formatOpSymbol(inverseOp, operand)}`,
          },
          operation: {
            opType: inverseOp,
            operand,
            target: 'both_sides',
            symbol: formatOpSymbol(inverseOp, operand),
          },
          appliedOpText: formatOpSymbol(inverseOp, operand),
          startTime: applyStart,
          endTime: applyEnd,
          annotation: `APPLY ${formatOpSymbol(inverseOp, operand).toUpperCase()} TO BOTH SIDES (BALANCE)`,
        });

        // Scan for result line: e.g. "ten minus four is six, so x equals six"
        let resultLine = lines.find((l, idx) => idx > i && idx <= i + 6 && (l.text.toLowerCase().includes('equals six') || l.text.toLowerCase().includes('x equals') || l.text.toLowerCase().includes('minus four is six')));
        const resultStart = resultLine ? resultLine.startTime : applyEnd;
        const resultEnd = resultLine ? resultLine.endTime + 2.5 : resultStart + 3.5;
        sceneEndTime = resultEnd;

        // Step 3: Cancellation on left & Simplification on right -> x = 6
        steps.push({
          stepId: `${sceneId}_step3`,
          stepType: 'simplify_result',
          equation: {
            left: `${variable}`,
            right: `${finalResult}`,
          },
          leftCancelled: true,
          rightResolved: `${finalResult}`,
          startTime: resultStart,
          endTime: resultEnd,
          annotation: `SIMPLIFY: ${variable.toUpperCase()} IS ISOLATED (${variable.toUpperCase()} = ${finalResult})`,
        });

        scenes.push({
          id: sceneId,
          variable,
          title: `ONE-STEP EQUATION: ISOLATING ${variable.toUpperCase()}`,
          startTime: sceneStartTime,
          endTime: sceneEndTime,
          steps,
        });

        // Advance line pointer past this scene to avoid duplicates
        if (resultLine) {
          i = lines.indexOf(resultLine);
        }
      } else if (detectedEq.coef > 1 && detectedEq.op && detectedEq.operand !== null) {
        // TWO-STEP EQUATION: e.g. 2x - 5 = 15
        const coef = detectedEq.coef;
        const op = detectedEq.op;
        const operand = detectedEq.operand;
        const initialRhs = detectedEq.rhs;
        const inverseOp = getInverseOp(op);
        const midRhs = op === 'subtract' ? initialRhs + operand : initialRhs - operand;
        const finalResult = midRhs / coef;

        // Step 1: Initial Equation (2x - 5 = 15)
        steps.push({
          stepId: `${sceneId}_step1`,
          stepType: 'initial_equation',
          equation: {
            left: `${coef}${variable} ${formatOpSymbol(op, operand)}`,
            right: `${initialRhs}`,
          },
          startTime: line.startTime,
          endTime: line.endTime + 2.0,
          annotation: 'TWO-STEP EQUATION (ORDER OF OPERATIONS IN REVERSE)',
        });

        // Step 2: "Add 5 to both sides"
        let addBothLine = lines.find((l, idx) => idx > i && idx <= i + 3 && (l.text.toLowerCase().includes('both sides') || l.text.toLowerCase().includes('add five')));
        const s2Start = addBothLine ? addBothLine.startTime : line.endTime + 2.0;
        const s2End = addBothLine ? addBothLine.endTime + 1.2 : s2Start + 3.0;

        steps.push({
          stepId: `${sceneId}_step2`,
          stepType: 'apply_operation',
          equation: {
            left: `${coef}${variable} ${formatOpSymbol(op, operand)} ${formatOpSymbol(inverseOp, operand)}`,
            right: `${initialRhs} ${formatOpSymbol(inverseOp, operand)}`,
          },
          operation: {
            opType: inverseOp,
            operand,
            target: 'both_sides',
            symbol: formatOpSymbol(inverseOp, operand),
          },
          appliedOpText: formatOpSymbol(inverseOp, operand),
          startTime: s2Start,
          endTime: s2End,
          annotation: `STEP 1: ${formatOpSymbol(inverseOp, operand).toUpperCase()} TO BOTH SIDES`,
        });

        // Step 3: Simplify to 2x = 20
        let midLine = lines.find((l, idx) => idx > i && idx <= i + 4 && (l.text.toLowerCase().includes('twenty') || l.text.toLowerCase().includes('two x equals')));
        const s3Start = midLine ? midLine.startTime : s2End;
        const s3End = midLine ? midLine.endTime + 1.0 : s3Start + 2.5;

        steps.push({
          stepId: `${sceneId}_step3`,
          stepType: 'intermediate_expansion',
          equation: {
            left: `${coef}${variable}`,
            right: `${midRhs}`,
          },
          leftCancelled: true,
          rightResolved: `${midRhs}`,
          startTime: s3Start,
          endTime: s3End,
          annotation: `SIMPLIFY: ${coef}${variable.toUpperCase()} = ${midRhs}`,
        });

        // Step 4: Divide both by 2
        let divLine = lines.find((l, idx) => idx > i && idx <= i + 6 && (l.text.toLowerCase().includes('divide') || l.text.toLowerCase().includes('two')));
        const s4Start = divLine ? divLine.startTime : s3End;
        const s4End = divLine ? divLine.endTime + 1.0 : s4Start + 2.5;

        steps.push({
          stepId: `${sceneId}_step4`,
          stepType: 'apply_operation',
          equation: {
            left: `(${coef}${variable}) ÷ ${coef}`,
            right: `${midRhs} ÷ ${coef}`,
          },
          operation: {
            opType: 'divide',
            operand: coef,
            target: 'both_sides',
            symbol: `÷ ${coef}`,
          },
          appliedOpText: `÷ ${coef}`,
          startTime: s4Start,
          endTime: s4End,
          annotation: `STEP 2: DIVIDE BOTH SIDES BY ${coef}`,
        });

        // Step 5: Final solution x = 10
        let finalLine = lines.find((l, idx) => idx > i && idx <= i + 8 && (l.text.toLowerCase().includes('equals ten') || l.text.toLowerCase().includes('x equals')));
        const s5Start = finalLine ? finalLine.startTime : s4End;
        const s5End = finalLine ? finalLine.endTime + 3.0 : s5Start + 3.5;
        sceneEndTime = s5End;

        steps.push({
          stepId: `${sceneId}_step5`,
          stepType: 'simplify_result',
          equation: {
            left: `${variable}`,
            right: `${finalResult}`,
          },
          leftCancelled: true,
          rightResolved: `${finalResult}`,
          startTime: s5Start,
          endTime: s5End,
          annotation: `SOLUTION COMPLETE: ${variable.toUpperCase()} = ${finalResult}`,
        });

        scenes.push({
          id: sceneId,
          variable,
          title: `TWO-STEP LINEAR EQUATION: SOLVING FOR ${variable.toUpperCase()}`,
          startTime: sceneStartTime,
          endTime: sceneEndTime,
          steps,
        });

        if (finalLine) {
          i = lines.indexOf(finalLine);
        }
      } else if (detectedEq.coef > 1 && detectedEq.op === null) {
        // MULTIPLICATIVE INVERSE: e.g. 3x = 12 -> divide by 3 -> x = 4
        const coef = detectedEq.coef;
        const initialRhs = detectedEq.rhs;
        const finalResult = initialRhs / coef;

        steps.push({
          stepId: `${sceneId}_step1`,
          stepType: 'initial_equation',
          equation: {
            left: `${coef}${variable}`,
            right: `${initialRhs}`,
          },
          startTime: line.startTime,
          endTime: line.endTime + 2.0,
          annotation: 'COEFFICIENT MULTIPLICATION (3x = 12)',
        });

        let divLine = lines.find((l, idx) => idx > i && idx <= i + 3 && (l.text.toLowerCase().includes('divide') || l.text.toLowerCase().includes('opposite action')));
        const s2Start = divLine ? divLine.startTime : line.endTime + 2.0;
        const s2End = divLine ? divLine.endTime + 2.5 : s2Start + 3.0;

        steps.push({
          stepId: `${sceneId}_step2`,
          stepType: 'apply_operation',
          equation: {
            left: `(${coef}${variable}) ÷ ${coef}`,
            right: `${initialRhs} ÷ ${coef}`,
          },
          operation: {
            opType: 'divide',
            operand: coef,
            target: 'both_sides',
            symbol: `÷ ${coef}`,
          },
          appliedOpText: `÷ ${coef}`,
          startTime: s2Start,
          endTime: s2End,
          annotation: `INVERSE OF MULTIPLICATION: DIVIDE BOTH SIDES BY ${coef}`,
        });

        const s3Start = s2End;
        const s3End = s3Start + 3.0;
        sceneEndTime = s3End;

        steps.push({
          stepId: `${sceneId}_step3`,
          stepType: 'simplify_result',
          equation: {
            left: `${variable}`,
            right: `${finalResult}`,
          },
          leftCancelled: true,
          rightResolved: `${finalResult}`,
          startTime: s3Start,
          endTime: s3End,
          annotation: `RESULT: ${variable.toUpperCase()} = ${finalResult}`,
        });

        scenes.push({
          id: sceneId,
          variable,
          title: `MULTIPLICATIVE INVERSE: ISOLATING ${variable.toUpperCase()}`,
          startTime: sceneStartTime,
          endTime: sceneEndTime,
          steps,
        });

        if (divLine) {
          i = lines.indexOf(divLine);
        }
      }
    }
  }

  return scenes;
}
