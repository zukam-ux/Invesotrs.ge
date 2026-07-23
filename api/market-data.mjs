import getMarketData from "../netlify/functions/market-data.mjs";

export default async function handler(_request, response) {
  const result = await getMarketData();

  result.headers.forEach((value, key) => {
    response.setHeader(key, value);
  });
  response.status(result.status);
  response.send(Buffer.from(await result.arrayBuffer()));
}
