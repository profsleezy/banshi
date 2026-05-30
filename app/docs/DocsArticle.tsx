import Link from 'next/link'
import DashboardShell from '../../components/DashboardShell'
import TerminalIcon from '../../components/TerminalIcon'
import { type DocsSlug, docsPages, getDocsPage } from './docsContent'

type Props = {
  slug: DocsSlug
}

export default function DocsArticle({ slug }: Props) {
  const page = getDocsPage(slug)

  if (!page) {
    return (
      <DashboardShell>
        <div className="p-6">
          <div className="terminal-panel rounded p-5 text-sm text-zinc-400">Guide not found.</div>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="terminal-boot mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="terminal-card h-max rounded p-4">
          <Link href="/docs" className="focus-ring inline-flex items-center gap-2 rounded text-sm text-zinc-400 hover:text-emerald-200">
            <TerminalIcon name="chevron" className="h-4 w-4 rotate-180" />
            Docs center
          </Link>
          <div className="terminal-divider my-4" />
          <nav className="grid gap-2" aria-label="Docs navigation">
            {docsPages.map((item) => {
              const active = item.slug === slug
              return (
                <Link
                  key={item.slug}
                  href={`/docs/${item.slug}`}
                  className={`focus-ring rounded border px-3 py-2 text-sm transition ${
                    active
                      ? 'border-zinc-700 bg-zinc-900 text-zinc-100'
                      : 'border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900/60 hover:text-zinc-200'
                  }`}
                >
                  {item.title}
                </Link>
              )
            })}
          </nav>
        </aside>

        <article className="min-w-0">
          <section className="terminal-panel rounded-lg p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="terminal-chip inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-medium">
                <TerminalIcon name={page.icon} className="h-3.5 w-3.5" />
                {page.kicker}
              </span>
              <span className="rounded border border-zinc-800 bg-black/30 px-2 py-1 text-xs text-zinc-500">{page.readTime}</span>
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight text-zinc-50">{page.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">{page.summary}</p>
          </section>

          <div className="mt-5 grid gap-4">
            {page.sections.map((section, index) => (
              <section key={section.title} className="terminal-card rounded p-5 sm:p-6">
                <div className="terminal-label text-xs">section {index + 1}</div>
                <h2 className="mt-2 text-xl font-semibold text-zinc-50">{section.title}</h2>
                <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.steps && (
                  <ol className="mt-5 grid gap-2">
                    {section.steps.map((step, stepIndex) => (
                      <li key={step} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 rounded border border-zinc-800 bg-black/25 p-3 text-sm text-zinc-300">
                        <span className="flex h-7 w-7 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-xs text-emerald-200">{stepIndex + 1}</span>
                        <span className="leading-6">{step}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        </article>
      </div>
    </DashboardShell>
  )
}
