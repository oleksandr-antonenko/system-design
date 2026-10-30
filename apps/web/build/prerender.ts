import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { type Plugin, type PluginOption, runnerImport } from 'vite'

// The app renders in the browser, so search engines and link previews would
// see only the empty shell. After the build this plugin writes a real page
// for every catalogue, course and lesson address, plus sitemap.xml and
// robots.txt. What goes into them is decided in `src/seo/site.ts` (pure and
// tested); this file only loads it through Vite and writes the files.

type SiteFile = Readonly<{ file: string; content: string }>

type SiteModule = Readonly<{
  siteUrlOf: (value: string | undefined) => string
  renderSite: (
    options: Readonly<{
      siteUrl: string
      template: string
      assetUrl: (sourceUrl: string) => string
    }>,
  ) => ReadonlyArray<SiteFile>
}>

export type PrerenderOptions = Readonly<{
  /** The site's address for canonical links, og:image and the sitemap.
      Defaults to the `SITE_URL` environment variable. */
  siteUrl?: string
  /** Plugins the course sources need to load outside the app build. */
  plugins?: ReadonlyArray<PluginOption>
}>

// `src/courses/networks/lessons/03-site-names/preview-600.webp`
const LESSON_PREVIEW =
  /(?:^|\/)courses\/([^/]+)\/lessons\/\d+-([^/]+)\/(preview(?:-\d+)?)\.webp$/

/** A lesson's picture keeps the lesson in its file name
    (`assets/networks-site-names-preview-3f2a.webp`): image search reads it. */
export const previewFileName = (
  sources: ReadonlyArray<string>,
  assetsDir: string,
) => {
  const match = sources
    .map(source => LESSON_PREVIEW.exec(source))
    .find(found => found !== null)
  return match === undefined || match === null
    ? undefined
    : `${assetsDir}/${match[1]}-${match[2]}-${match[3]}-[hash][extname]`
}

export const prerender = (options: PrerenderOptions = {}): Plugin => {
  const state = { root: '', base: '/' }

  return {
    name: 'prerender-pages',
    apply: (_config, env) => env.command === 'build' || env.isPreview === true,
    config(config) {
      const assetsDir = config.build?.assetsDir ?? 'assets'
      return {
        build: {
          rolldownOptions: {
            output: {
              assetFileNames: asset =>
                previewFileName(asset.originalFileNames, assetsDir) ??
                `${assetsDir}/[name]-[hash][extname]`,
            },
          },
        },
      }
    },
    configResolved(config) {
      state.root = config.root
      state.base = config.base
    },
    // `vite preview` answers `/en/…/lessons/load-balancer` with the page
    // written for it, as a server that serves `<path>/index.html` would.
    configurePreviewServer(server) {
      const outDir = resolve(server.config.root, server.config.build.outDir)
      server.middlewares.use((request, _response, next) => {
        const url = new URL(request.url ?? '/', 'http://preview')
        const page = join(outDir, url.pathname, 'index.html')
        if (
          !url.pathname.endsWith('/') &&
          !/\.[a-z0-9]+$/i.test(url.pathname) &&
          page.startsWith(outDir + sep) &&
          existsSync(page)
        ) {
          request.url = `${url.pathname}/index.html${url.search}`
        }
        next()
      })
    },
    async writeBundle(output, bundle) {
      if (this.environment.name !== 'client' || output.dir === undefined) {
        return
      }
      const outDir = output.dir
      const shell = bundle['index.html']
      if (shell === undefined || shell.type !== 'asset') {
        this.error('prerender: the build has no index.html')
      }
      const template =
        typeof shell.source === 'string'
          ? shell.source
          : new TextDecoder().decode(shell.source)

      // `import.meta.glob(…, { query: '?url' })` gives the source path
      // (`/src/courses/…/preview.webp`) outside the app build; the bundle
      // knows which hashed file each source became.
      const builtAssets = new Map<string, string>(
        Object.values(bundle).flatMap(file =>
          file.type === 'asset'
            ? file.originalFileNames.map(
                source =>
                  [`/${source}`, `${state.base}${file.fileName}`] as const,
              )
            : [],
        ),
      )

      const { module } = await runnerImport<SiteModule>(
        join(state.root, 'src/seo/site.ts'),
        {
          root: state.root,
          logLevel: 'warn',
          plugins: [...(options.plugins ?? [])],
        },
      )
      const configured = options.siteUrl ?? process.env['SITE_URL']
      if (configured === undefined || configured.trim() === '') {
        this.warn(
          'SITE_URL is not set: canonical links, og:image and the sitemap point at the local preview server',
        )
      }
      const siteUrl = module.siteUrlOf(configured)
      const files = module.renderSite({
        siteUrl,
        template,
        assetUrl: sourceUrl => {
          const built = builtAssets.get(sourceUrl)
          if (built === undefined) {
            throw new Error(`prerender: ${sourceUrl} is not in the build`)
          }
          return built
        },
      })

      await Promise.all(
        files.map(async ({ file, content }) => {
          const target = join(outDir, file)
          await mkdir(dirname(target), { recursive: true })
          await writeFile(target, content)
        }),
      )
      this.info(`prerendered ${files.length - 2} pages for ${siteUrl}`)
    },
  }
}
