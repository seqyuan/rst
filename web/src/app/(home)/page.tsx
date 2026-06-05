import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1 max-w-3xl mx-auto px-6">
      <h1 className="text-4xl font-semibold mb-4">rst-renderer</h1>
      <p className="mb-3 text-lg text-fd-muted-foreground">
        reStructuredText renderer for JavaScript/TypeScript
      </p>
      <p className="text-fd-muted-foreground mb-8">
        Parse RST to a unified AST, then render to HTML, React components, or
        Markdown. Includes a Jinja2-compatible template engine and Vite plugin.
      </p>
      <div className="flex flex-row gap-4 justify-center">
        <Link
          href="/docs"
          className="inline-flex items-center justify-center rounded-full px-8 py-2.5 bg-fd-primary text-fd-primary-foreground font-medium"
        >
          Get Started
        </Link>
        <a
          href="https://github.com/seqyuan/rst"
          className="inline-flex items-center justify-center rounded-full px-8 py-2.5 border font-medium"
        >
          GitHub
        </a>
      </div>
    </div>
  )
}
