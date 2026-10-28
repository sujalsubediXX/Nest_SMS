import { jest } from "@jest/globals";

jest.unstable_mockModule("../models/message.model.js", () => ({
  default: {
    updateOne: jest.fn().mockResolvedValue({}),
  },
}));
jest.unstable_mockModule("../services/refund.js", () => ({
  default: jest.fn().mockResolvedValue(),
}));

const { default: deliver } = await import("../services/deliver.js");
const { default: Message } = await import("../models/message.model.js");
const { default: refundMessage } = await import("../services/refund.js");


// a fake provider that always succeeds or always fails
function fakeProvider(name, { balance = 100, fails = false } = {}) {
  return {
    name,
    getBalance: jest.fn().mockResolvedValue(balance),
    send: fails
      ? jest.fn().mockRejectedValue(new Error(`${name} failed`))
      : jest.fn().mockResolvedValue(),
  };
}

const msg = { _id: "m1", to: "9841234567", parts: 1, cost: 1, userId: "u1" };

beforeEach(() => jest.clearAllMocks());

describe("deliver (failover)", () => {
  test("uses the first provider if it succeeds", async () => {
    const a = fakeProvider("ROUTE_A");
    const b = fakeProvider("ROUTE_B");
    await deliver(msg, [a, b]);

    expect(a.send).toHaveBeenCalledTimes(1);
    expect(b.send).not.toHaveBeenCalled();
    expect(refundMessage).not.toHaveBeenCalled();
  });

  test("falls over to the next provider when the first fails", async () => {
    const a = fakeProvider("ROUTE_A", { fails: true });
    const b = fakeProvider("ROUTE_B");
    await deliver(msg, [a, b]);

    expect(b.send).toHaveBeenCalledTimes(1);
    expect(Message.updateOne).toHaveBeenCalledWith(
      { _id: "m1" },
      expect.objectContaining({ status: "sent", provider: "ROUTE_B" })
    );
  });

  test("skips a provider with too little balance", async () => {
    const a = fakeProvider("ROUTE_A", { balance: 0 });
    const b = fakeProvider("ROUTE_B");
    await deliver(msg, [a, b]);

    expect(a.send).not.toHaveBeenCalled();
    expect(b.send).toHaveBeenCalledTimes(1);
  });

  test("refunds when every provider fails", async () => {
    const a = fakeProvider("ROUTE_A", { fails: true });
    const b = fakeProvider("ROUTE_B", { fails: true });
    await deliver(msg, [a, b]);

    expect(refundMessage).toHaveBeenCalledTimes(1);
  });
});