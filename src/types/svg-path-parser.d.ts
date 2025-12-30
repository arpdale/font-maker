declare module 'svg-path-parser' {
  interface Command {
    code: string;
    command?: string;
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    rx?: number;
    ry?: number;
    xAxisRotation?: number;
    largeArc?: boolean;
    sweep?: boolean;
  }

  export function parseSVG(d: string): Command[];
  export function makeAbsolute(commands: Command[]): Command[];
}
