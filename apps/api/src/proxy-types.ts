/** Shared Fastify reply shape used by the LLM proxy and extracted helpers. */
export type ReplyLike = {
  status: (code: number) => ReplyLike;
  header: (name: string, value: string) => ReplyLike;
  send: (body: unknown) => void;
  raw: NodeJS.WritableStream & { end: () => void };
};
