import countParts  from "../utils/smsPart.js";

describe("countParts", () => {
  test("short English message is 1 part", () => {
    expect(countParts("Hello")).toEqual({ parts: 1, encoding: "GSM-7" });
  });

  test("GSM-7 boundary: 160 is 1 part, 161 is 2", () => {
    expect(countParts("a".repeat(160)).parts).toBe(1);
    expect(countParts("a".repeat(161)).parts).toBe(2);
  });

  test("200-character English message is 2 parts", () => {
    expect(countParts("a".repeat(200)).parts).toBe(2);
  });

  test("Nepali text is Unicode", () => {
    expect(countParts("नमस्ते").encoding).toBe("Unicode");
  });

  test("Unicode boundary: 70 is 1 part, 71 is 2", () => {
    expect(countParts("क".repeat(70)).parts).toBe(1);
    expect(countParts("क".repeat(71)).parts).toBe(2);
  });

  test("100-character Nepali message is 2 parts", () => {
    expect(countParts("क".repeat(100)).parts).toBe(2);
  });

  test("one emoji makes the whole message Unicode", () => {
    expect(countParts("Hello 😊").encoding).toBe("Unicode");
  });
});