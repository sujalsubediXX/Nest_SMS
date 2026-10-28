
import normalizeNumber  from "../utils/normalizeNumber.js";

describe("normalizeNumber", () => {
  test("valid number stays as it is", () => {
    expect(normalizeNumber("9841234567")).toBe("9841234567");
  });

  test("+977 prefix is removed", () => {
    expect(normalizeNumber("+9779801122334")).toBe("9801122334");
  });

  test("977 prefix is removed", () => {
    expect(normalizeNumber("9779761234567")).toBe("9761234567");
  });

  test("a number that merely starts with 977 is not stripped", () => {
    expect(normalizeNumber("9771234567")).toBe("9771234567");
  });

  test("rejects numbers not starting with 97 or 98", () => {
    expect(normalizeNumber("9612345678")).toBeNull();
  });

  test("rejects 9-digit numbers", () => {
    expect(normalizeNumber("984123456")).toBeNull();
  });

  test("rejects letters and empty input", () => {
    expect(normalizeNumber("98412abcde")).toBeNull();
    expect(normalizeNumber("")).toBeNull();
  });
});