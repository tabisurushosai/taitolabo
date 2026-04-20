declare module "kuromoji" {
  type BuildCallback = (
    err: Error | null,
    tokenizer: { tokenize: (text: string) => unknown[] }
  ) => void;

  const kuromoji: {
    builder: (opts: { dicPath: string }) => {
      build: (cb: BuildCallback) => void;
    };
  };

  export default kuromoji;
}
