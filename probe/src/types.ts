/** All text positions are UTF-16 offsets, as used by browser selection APIs. */
export type Range = { from: number; to: number };
export type Snapshot = {
  editorId: string;
  revision: number;
  text: string;
  selection: Range;
};
export type Edit = {
  expected: Snapshot;
  replace: Range;
  insert: string;
  /** Absolute field positions in the equation after the edit. */
  fields: Range[];
  /** Repeated occurrences corresponding to each editable field. */
  mirrors?: Range[][];
  exit: number;
};
export type InputContext = { kind: string; composing: boolean };

/** A synchronous contract, subject to confirmation against the live host. */
export interface PaperPort {
  read(): Snapshot | null;
  apply(edit: Edit): boolean;
  select(expected: Snapshot, range: Range): boolean;
  dispose(): void;
}
