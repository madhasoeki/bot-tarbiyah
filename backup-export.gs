// JALANKAN SCRIPT INI DI APPS SCRIPT SEBELUM HAPUS SPREADSHEET
// Untuk backup data ke format yang bisa diimport ke Render

function exportDataForMigration() {
  try {
    const spreadsheet = SpreadsheetApp.openById('1oDIDLGo4vm1B7HUNg3NrLP6UoKws6X2ShMPZHJo8CPE')
    
    // Export Users data
    const usersSheet = spreadsheet.getSheetByName('Users')
    const tarbiyahSheet = spreadsheet.getSheetByName('Tarbiyah')
    
    let exportData = {
      users: {},
      tarbiyah: {},
      exportDate: new Date().toISOString()
    }
    
    // Export users
    if (usersSheet) {
      const usersData = usersSheet.getDataRange().getValues()
      for (let i = 1; i < usersData.length; i++) { // skip header
        const row = usersData[i]
        const userId = row[0].toString()
        exportData.users[userId] = {
          telegramId: row[0],
          firstName: row[1] || '',
          lastName: row[2] || '',
          username: row[3] || '',
          displayName: row[5] || '', // nama_tarbiyah
          createdAt: row[4] ? new Date(row[4]).toISOString() : new Date().toISOString()
        }
      }
    }
    
    // Export tarbiyah records
    if (tarbiyahSheet) {
      const tarbiyahData = tarbiyahSheet.getDataRange().getValues()
      for (let i = 1; i < tarbiyahData.length; i++) { // skip header
        const row = tarbiyahData[i]
        const userName = row[1] // nama user
        const date = row[0] ? Utilities.formatDate(new Date(row[0]), 'GMT+7', 'yyyy-MM-dd') : ''
        
        if (!userName || !date) continue
        
        // Find user by name
        let userId = null
        for (const [id, user] of Object.entries(exportData.users)) {
          if (user.displayName === userName) {
            userId = id
            break
          }
        }
        
        if (userId) {
          if (!exportData.tarbiyah[userId]) {
            exportData.tarbiyah[userId] = {}
          }
          
          exportData.tarbiyah[userId][date] = {
            tahajud: row[2] === '✓',
            qobliyahSubuh: row[3] === '✓',
            subuh: row[4] === '✓',
            dhuha: row[5] === '✓',
            qobliyahDzuhur: row[6] === '✓',
            dzuhur: row[7] === '✓',
            badiahDzuhur: row[8] === '✓',
            qobliyahAshar: row[9] === '✓',
            ashar: row[10] === '✓',
            maghrib: row[11] === '✓',
            badiahMaghrib: row[12] === '✓',
            qobliyahIsya: row[13] === '✓',
            isya: row[14] === '✓',
            badiahIsya: row[15] === '✓',
            odoj: row[16] === '✓',
            nafs: row[17] === '✓',
            bacaArtiQuran: row[18] === '✓',
            infaqSubuh: row[19] === '✓',
            istighfar: row[20] === '✓',
            sholawat: row[21] === '✓',
            buzzer: row[22] === '✓',
            updatedAt: new Date().toISOString()
          }
        }
      }
    }
    
    // Create downloadable JSON
    const jsonString = JSON.stringify(exportData, null, 2)
    
    // Log untuk copy-paste
    console.log('=== BACKUP DATA ===')
    console.log('Copy JSON dibawah ini dan simpan sebagai backup.json')
    console.log('=====================================')
    console.log(jsonString)
    console.log('=====================================')
    
    // Create Drive file as backup
    const fileName = `tarbiyah-backup-${Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd-HHmm')}.json`
    const blob = Utilities.newBlob(jsonString, 'application/json', fileName)
    const file = DriveApp.createFile(blob)
    
    console.log(`Backup saved to Google Drive: ${file.getName()}`)
    console.log(`File URL: ${file.getUrl()}`)
    
    return {
      success: true,
      totalUsers: Object.keys(exportData.users).length,
      totalRecords: Object.keys(exportData.tarbiyah).length,
      fileName: fileName,
      fileUrl: file.getUrl()
    }
    
  } catch(err) {
    console.log(`Export error: ${err.toString()}`)
    return { success: false, error: err.toString() }
  }
}
