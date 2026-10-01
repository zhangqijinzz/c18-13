import { describe, expect, it } from 'vitest'
import { BrandMirrorViewModel } from '../viewmodels/brandMirrorViewModel'
import type { BrandDocument } from '../models/brandMirrorModels'
import type { BrandRepository } from '../repositories/brandRepository'
import { buildBrandGuidelinesMarkdown, type BrandGuidelinesExporter } from '../services/exportService'

class MemoryRepository implements BrandRepository {
  document: BrandDocument | null = null
  shouldFail = false
  load(): BrandDocument | null { return this.document }
  save(document: BrandDocument): void { if (this.shouldFail) throw new Error('offline'); this.document = document }
}

class MemoryExporter implements BrandGuidelinesExporter {
  received: string | null = null
  export(snapshot: Parameters<BrandGuidelinesExporter['export']>[0]): void { this.received = buildBrandGuidelinesMarkdown(snapshot) }
}

describe('BrandMirrorViewModel', () => {
  it('initializes, updates tokens and persists the latest state', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.updateScale('typeScale', 0, 18)
    expect(viewModel.getSnapshot().tokens.primary).toBe('#123456')
    expect(viewModel.getSnapshot().tokens.typeScale[0]).toBe(18)
    expect(repository.document?.tokens.primary).toBe('#123456')
  })

  it('saves two versions and enters comparison mode', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.saveVersion()
    viewModel.updateColor('primary', '#238B73')
    viewModel.saveVersion()
    viewModel.toggleCompare()
    expect(viewModel.getSnapshot().versions.map((version) => version.label)).toEqual(['Version A', 'Version B'])
    expect(viewModel.getSnapshot().compareMode).toBe(true)
  })

  function viewModelInCompareMode(exporter?: MemoryExporter): BrandMirrorViewModel {
    const viewModel = new BrandMirrorViewModel(new MemoryRepository(), exporter)
    viewModel.initialize()
    viewModel.saveVersion()
    viewModel.updateColor('primary', '#238B73')
    viewModel.saveVersion()
    viewModel.toggleCompare()
    return viewModel
  }

  it('ends comparison with a clear notice when a token changes during compare', () => {
    const viewModel = viewModelInCompareMode()
    viewModel.updateColor('primary', '#111111')
    expect(viewModel.getSnapshot().compareMode).toBe(false)
    expect(viewModel.getSnapshot().message).toContain('令牌已更新')
    expect(viewModel.getSnapshot().message).toContain('已退出对比模式')
  })

  it('ends comparison with a clear notice when switching theme or resetting during compare', () => {
    const themed = viewModelInCompareMode()
    themed.selectTheme('night')
    expect(themed.getSnapshot().compareMode).toBe(false)
    expect(themed.getSnapshot().message).toContain('已切换基础主题')
    expect(themed.getSnapshot().message).toContain('已退出对比模式')

    const reset = viewModelInCompareMode()
    reset.reset()
    expect(reset.getSnapshot().compareMode).toBe(false)
    expect(reset.getSnapshot().message).toContain('已恢复默认令牌')
    expect(reset.getSnapshot().message).toContain('已退出对比模式')
  })

  it('ends comparison with a clear notice when saving a version during compare', () => {
    const viewModel = viewModelInCompareMode()
    viewModel.saveVersion()
    expect(viewModel.getSnapshot().versions).toHaveLength(3)
    expect(viewModel.getSnapshot().compareMode).toBe(false)
    expect(viewModel.getSnapshot().message).toContain('版本已保存')
    expect(viewModel.getSnapshot().message).toContain('已退出对比模式')
  })

  it('requires two saved versions before entering comparison', () => {
    const viewModel = new BrandMirrorViewModel(new MemoryRepository())
    viewModel.initialize()
    viewModel.toggleCompare()
    expect(viewModel.getSnapshot().compareMode).toBe(false)
    expect(viewModel.getSnapshot().message).toContain('先保存两个版本')
  })

  it('keeps comparison active for read-only actions like export', () => {
    const exporter = new MemoryExporter()
    const viewModel = viewModelInCompareMode(exporter)
    viewModel.exportBrandGuidelines()
    expect(exporter.received).toContain('# BrandMirror 品牌规范')
    expect(viewModel.getSnapshot().compareMode).toBe(true)
    expect(viewModel.getSnapshot().message).toContain('导出')
  })

  it('keeps editing usable when persistence fails', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    repository.shouldFail = true
    viewModel.updateColor('secondary', '#FFFFFF')
    expect(viewModel.getSnapshot().status).toBe('error')
    expect(viewModel.getSnapshot().tokens.secondary).toBe('#FFFFFF')
  })

  it('recovers a previously persisted document on initialization', () => {
    const repository = new MemoryRepository()
    repository.document = { version: 1, theme: 'night', tokens: { primary: '#A98BFF', secondary: '#191829', radiusScale: [6, 10, 14, 22], spacingScale: [4, 8, 12, 18, 28], typeScale: [12, 14, 16, 20, 28, 38] }, versions: [] }
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    expect(viewModel.getSnapshot().theme).toBe('night')
    expect(viewModel.getSnapshot().message).toContain('恢复')
  })

  it('exports the current token system as brand guidelines', () => {
    const repository = new MemoryRepository()
    const exporter = new MemoryExporter()
    const viewModel = new BrandMirrorViewModel(repository, exporter)
    viewModel.initialize()
    viewModel.exportBrandGuidelines()
    expect(exporter.received).toContain('# BrandMirror 品牌规范')
    expect(exporter.received).toContain('`primary`')
    expect(viewModel.getSnapshot().message).toContain('导出')
  })
})
