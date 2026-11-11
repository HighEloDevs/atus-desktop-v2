/**
 * @module
 * Display of a project file's complete path.
 */

/**
 * Displays the complete project path.
 * @param props - Path to display.
 * @returns The rendered React element.
 */
export function ProjectFilePath({ path }: { path: string }) {
  return (
    <span dir="auto" className="mt-0.5 block text-xs break-all text-muted-foreground">
      {path}
    </span>
  );
}
