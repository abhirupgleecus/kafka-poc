interface JsonViewerProps {
  data: unknown;
  className?: string;
}

export function JsonViewer({ data, className }: JsonViewerProps) {
  const content = JSON.stringify(data, null, 2);

  return (
    <pre
      className={`max-h-80 w-full overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100 ${
        className ?? ""
      }`}
    >
      {content}
    </pre>
  );
}

