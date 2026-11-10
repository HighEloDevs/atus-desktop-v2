export function ProjectFilePath({ path }: { path: string }) {
  return (
    <span dir="auto" className="mt-0.5 block text-xs break-all text-muted-foreground">
      {path}
    </span>
  );
}
