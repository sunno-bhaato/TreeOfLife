export type Person = {
  id: string;
  name: string;
  photo_url: string | null;
  /** The marriage/union these people were born into (children emerge from its midpoint). */
  parent_union_id: string | null;
  pos_x: number;
  pos_y: number;
};

/** A couple (a_id + b_id) or a single parent (b_id = null). */
export type Union = {
  id: string;
  a_id: string;
  b_id: string | null;
};
