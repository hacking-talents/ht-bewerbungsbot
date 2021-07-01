import {
  CandidateDropdownField,
  CandidateField,
  CandidateSingleLineField,
} from "./types.ts";

export const isDropdownField = (
  field: CandidateField,
): field is CandidateDropdownField => {
  return field.kind === "dropdown";
};

export const isSingleLineField = (
  field: CandidateField,
): field is CandidateSingleLineField => {
  return field.kind === "single_line";
};
