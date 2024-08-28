// const axios = require("axios").default;

const { default: axios } = require('axios')

const config = {
  headers: {
    Authorization: `token ${process.env.GH_TOKEN}`
  }
}

const getPreviousReleases = async ({ platform, target }) => {
  let { data } = await axios.get(
    'https://api.github.com/repos/dvlpralamin/delta-update-electron/releases',
    config
  )

  const ext = platform === 'win' ? (target === 'nsis-web' ? '.7z' : '.exe') : '.zip'

  let prevReleases = data.reduce((arr, release) => {
    release.assets
      .map((d) => {
        return d.browser_download_url
      })
      .filter((d) => {
        return !d.includes('untagged')
      })
      .filter((d) => d.endsWith(ext))
      .forEach((url) => {
        // ignore web installers or delta files
        if (!url.endsWith('-delta.exe') && !url.includes('-Setup')) {
          arr.push({ version: release.tag_name, url })
        }
      })
    return arr
  }, [])

  const oldreleases = prevReleases.slice(0, 3)

  console.log('prevReleases', oldreleases)

  return oldreleases
}

module.exports = getPreviousReleases
