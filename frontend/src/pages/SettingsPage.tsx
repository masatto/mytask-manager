import { PageTitle } from '../components/PageTitle.tsx'
import { PAGE_TITLES } from '../views.ts'
import { AboutSection } from './settings/AboutSection.tsx'
import { AreaSettings } from './settings/AreaSettings.tsx'
import { AutoBackupSection } from './settings/AutoBackupSection.tsx'
import { ManualBackupSection } from './settings/ManualBackupSection.tsx'
import { StorageSection } from './settings/StorageSection.tsx'
import { useBackupImport } from './settings/useBackupImport.tsx'

/**
 * S5 設定（screen-design 7章）。上から エリア → 保存場所 → 手動バックアップ → 自動バックアップ → このアプリについて。
 * 手動バックアップと自動バックアップの復元は、同じ確認ダイアログ（D3）を使う。
 */
export function SettingsPage() {
  const backupImport = useBackupImport()

  return (
    <section>
      <PageTitle {...PAGE_TITLES.settings} showArea={false} />

      <AreaSettings />
      <StorageSection />
      <ManualBackupSection
        onFileSelected={backupImport.checkFile}
        checking={backupImport.checking}
        importing={backupImport.importing}
        importError={backupImport.error}
      />
      <AutoBackupSection onRestore={backupImport.checkAutoBackup} disabled={backupImport.importing} />
      <AboutSection />

      {backupImport.dialog}
    </section>
  )
}
