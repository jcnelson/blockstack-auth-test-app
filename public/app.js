document.addEventListener("DOMContentLoaded", function(event) { 
  document.getElementById('signin-button').addEventListener('click', function() {
    var authRequest = blockstack.makeAuthRequest()
    blockstack.redirectToSignIn(window.location.origin, window.location.origin + '/manifest.json', ['store_write'])
  })
  document.getElementById('signout-button').addEventListener('click', function() {
    blockstack.signUserOut(window.location.origin)
  })

  function cell(data) {
    return '<div class="info Cell"><p>' + data + '</p></div>';
  }

  function row(data) {
    return '<div class="info Row">' + data + '</div>'
  }

  function table(data) {
    return '<div class="outer-div"><div class="center-div"><div class="info Table">' + data + '</div></div></div>'
  }

  function getPath(encrypted, signed) {
    return path = 'counter' + (encrypted ? '-encrypted' : '') + (signed ? '-signed': '') + '.json'
  }

  function showAuthData(profile, loginCounts) {
    var person = new blockstack.Person(profile);
    var version = getAuthResponseToken().version;
    var blockstackAPIUrl = getAuthResponseToken().blockstackAPIUrl;
    var associationToken = getAuthResponseToken().associationToken;
    var hubUrl = getAuthResponseToken().hubUrl;
    var metadata = getAuthResponseToken().metadata;
    document.getElementById('heading-name').innerHTML = person.name() + '<br>' +
      table(
        row(cell('authResponse version') + cell(version ? version : 'Not given')) +
        row(cell('authResponse hub URL') + cell(hubUrl ? hubUrl : 'Not given')) +
        row(cell('authResponse Core URL') + cell(blockstackAPIUrl ? blockstackAPIUrl : 'Not given')) +
        row(cell('authResponse metadata') + cell(metadata ? JSON.stringify(metadata) : 'Not given')) +
        row(cell('authResponse gaiaAssociationToken') + cell(associationToken ? associationToken.substring(0,25) + '...' : 'Not given')) +
        row(cell('login count (encrypted, signed)') + cell(loginCounts[0])) +
        row(cell('login count (encrypted)') + cell(loginCounts[1])) +
        row(cell('login count (signed)') + cell(loginCounts[2])) +
        row(cell('login count (plaintext)') + cell(loginCounts[3]))
      );
      
    document.getElementById('avatar-image').setAttribute('src', person.avatarUrl())
    document.getElementById('section-1').style.display = 'none'
    document.getElementById('section-2').style.display = 'block'
  }

  function getLoginCount(encrypted, signed) {
    path = getPath(encrypted, signed)
    return blockstack.getFile(path, { decrypt: encrypted, verify: signed })
      .then(function(dataJSON) {
        var data = null
        if (dataJSON === null) {
          console.log('No ' + path + '; instantiating')
          data = {'count': 0}
        }
        else {
          if (typeof dataJSON !== 'string') {
            console.log('Turn ' + dataJSON + ' into a string')
            dataJSON = window.nodeBuffer.Buffer.from(dataJSON).toString()
          }
          console.log('Loaded ' + dataJSON)
          data = JSON.parse(dataJSON)
        }
        return {'count': data.count, 'encrypted': encrypted, 'signed': signed}
      })
      .catch(function(e) {
        console.log(e)
        return {'count': 'ERROR!', 'encrypted': encrypted, 'signed': signed}
      })
  }

  function getAuthResponseToken() {
    return jsontokens.decodeToken(blockstack.loadUserData().authResponseToken).payload
  }

  if (blockstack.isUserSignedIn()) {
    var loginCounts = [
      getLoginCount(true, true),
      getLoginCount(true, false),
      getLoginCount(false, true),
      getLoginCount(false, false)
    ];

    Promise.all(loginCounts).then(function(results) {
      var profile = blockstack.loadUserData().profile
      showAuthData(profile, results.map(function(res) { return res.count }))
    })
  } else if (blockstack.isSignInPending()) {
    console.log('Signin is pending')
    var profile = null
    var counts = null
    blockstack.handlePendingSignIn()
      .then(function(userData) {
        profile = userData.profile
    
        var loginCounts = [
          getLoginCount(true, true),
          getLoginCount(true, false),
          getLoginCount(false, true),
          getLoginCount(false, false)
        ];

        return Promise.all(loginCounts);
      })
      .then(function(results) {
        counts = results;
        return results.map(function(res) {
          if (res.count !== 'ERROR!') {
            res.count += 1
          }
          else {
            res.count = 0
          }
          var path = getPath(res.encrypted, res.signed)
          return blockstack.putFile(path, JSON.stringify(res), { encrypt: res.encrypted, sign: res.signed })
        })
      })
      .then(function() {
        showAuthData(profile, counts.map(function(c) { return c.count }))
      })
  }
})
