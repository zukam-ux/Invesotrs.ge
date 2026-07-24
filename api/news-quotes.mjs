import getNewsQuotes from "../netlify/functions/news-quotes.mjs";

export default async function handler(request, response) {
  const query = new URLSearchParams(request.query ?? {}).toString();
  const result = await getNewsQuotes(
    new Request(`https://investors.ge/api/news-quotes${query ? `?${query}` : ""}`),
  );

  result.headers.forEach((value, key) => {
    response.setHeader(key, value);
  });
  response.status(result.status);
  response.send(Buffer.from(await result.arrayBuffer()));
}
