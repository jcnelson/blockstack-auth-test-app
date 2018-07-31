const express = require('express')
const cors = require('cors')

const port = 1800   // blockstack 18.xx
const app = express()
app.use(cors())
app.use('/', express.static(__dirname + '/public'))
app.listen(port, (err) => {
  console.log(`server is listening on port ${port}`)
})
