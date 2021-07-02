import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { addDaysToDate, dateToISO } from "./tools.ts";

Deno.test("addDaysToDate correctly adds given number of days", () => {
  const actual = addDaysToDate(new Date("2018-05-13"), 2);
  assertEquals(actual, new Date("2018-05-15"));
});

Deno.test("addDaysToDate correctly subtracts given number of days", () => {
  const actual = addDaysToDate(new Date("2018-05-13"), -2);
  assertEquals(actual, new Date("2018-05-11"));
});

Deno.test("dateToISO correctly converts date from Date", () => {
  const actual = dateToISO(new Date("2018-05-13"));
  assertEquals(actual, "2018-05-13");
});
