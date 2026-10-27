const URL = "http://localhost:3000/sms/send";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWUwMjJlNTMxZjdmNTk4Y2ZmMWMyN2UiLCJpYXQiOjE3OTMwNzM4OTMsImV4cCI6MTc5MzMzMzA5M30.xqISU-poPeqkpRGW_xqjvUZEPzZdHLVMBfH7TWVF6-Q";

async function main() {
  const body = JSON.stringify({ to: ["9841234567"], message: "Parallel test" });
  const COUNT = 90; // number of parallel requests

  const requests = Array.from({ length: COUNT }, () =>
    fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body,
    }).then(async (r) => ({ status: r.status, data: await r.json() }))
  );

  const results = await Promise.all(requests);

  console.log("200:", results.filter((r) => r.status === 200).length);
  console.log("402:", results.filter((r) => r.status === 402).length);
  console.log("429:", results.filter((r) => r.status === 429).length);

  // show the rate limit error message (first one is enough)
  const limited = results.find((r) => r.status === 429);
  if (limited) {
    console.log("429 response body:", limited.data);
  }
}

main();