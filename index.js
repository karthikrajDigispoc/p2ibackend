const express = require('express')
const app = express()
const multer = require('multer')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, __dirname + "/public/imageuploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-bezkoder-${file.originalname}`);
  },
});
var profile_upload = multer({ storage: storage })
app.use(express.static('public'));
const cors = require('cors')
const { Auth } = require("two-step-auth");
const connection = require('./db')
const bcrypt = require('bcrypt');
const { response } = require('express')
const saltRounds = 10;
app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
async function login(emailId) {
  try {
    let res = await Auth(emailId, "Passport2Immunity");
    let res1 = await res;
    return (res1)
  } catch (error) {
    console.log("error" + error);
  }
}
async function tokengenerate(req) {
  token = await jwt.sign(req, process.env.JWT_SECRET)
  return token
}
connection.connect(function (err) {
  err ? console.log("error unable to connect to db") : console.log("connected  to db")
})
app.post('/signup', (req, response) => {
  let { email_id, password } = req.body
  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      console.log("hash error", err)
    }
    else {
      let value = req.body
      req.body.password = undefined
      let token
      tokengenerate(value).then(res => {
        token = res
        console.log('token', token)
        if (token) {
          let stmt = 'insert into session_mgmt values(?,?)'
          values = [token, email_id]
          connection.query(stmt, values, (err, rows, fields) => {
            if (err) {
              if (err.errno === 1062) {
                stmt = 'update session_mgmt set session_id =? where email_id = ?'
                connection.query(stmt, values, function (err, rows, fields) {
                  if (err) {
                    console.log(err)
                  }
                  else {
                    let password2 = hash
                    login(email_id).then((res) => {
                      if (res.status === 200) {
                        console.log(res)
                        let verification_code = res.OTP
                        let values = [email_id, hash, verification_code]
                        let stmt = 'insert into users (email_id,password,verification_code) values (?,?,?)'
                        connection.query(stmt, values, (err, rows, fields) => {
                          if (err) {
                            if (err.errno === 1062) {
                              values = [password2, verification_code, email_id, email_id]
                              stmt = 'update users set password =?,verification_code = ? , modified_by = ? where email_id = ?'
                              connection.query(stmt, values, function (err, rows, fields) {
                                if (err) {
                                  console.log(err)
                                  response.status(401).send("Invalid User")
                                }

                                response.send(token)
                              })
                            }
                            else {
                              console.log(err)
                              response.status(401).send("Invalid User")
                            }
                          }
                          else {

                            response.send(token)
                          }
                        })

                      }
                      else {
                        response.status(401).send("Invalid Email Address")
                      }
                    })
                      .catch((err) => {
                        console.log(err)
                        response.status(401).send("Invalid User")
                      })
                  }
                })
              }
              else {
                response.status(401).send("Invalid User")
              }
            }
            else {
              let password2 = hash
              login(email_id).then((res) => {
                if (res.status === 200) {
                  console.log(res)
                  let verification_code = res.OTP
                  let values = [email_id, hash, verification_code]
                  let stmt = 'insert into users (email_id,password,verification_code) values (?,?,?)'
                  connection.query(stmt, values, (err, rows, fields) => {
                    if (err) {
                      if (err.errno === 1062) {
                        values = [password2, verification_code, email_id, email_id]
                        stmt = 'update users set password =?,verification_code = ? , modified_by = ? where email_id = ?'
                        connection.query(stmt, values, function (err, rows, fields) {

                          console.log("success")
                          response.send("success")
                        })
                      }
                      else {

                        response.status(401).send("failed")
                      }
                    }
                    else {

                      response.send("success")
                    }
                  })

                }
                else {
                  response.status(401).send("Invalid Email Address")
                }
              }).catch((err) => {
                response.status(401).send("Invalid User")
              })
            }
          })

        }
      }).catch(err => {
        response.status(401).send("Invalid User")
      })
    }
  });
});
app.post('/signup/otp', (req, response) => {
  let { email_id, otp } = req.body
  if (email_id && otp) {
    let stmt = 'select verification_code from users where email_id = ?'
    let value = [email_id]
    connection.query(stmt, value, (err, rows, fields) => {
      if (err) {
        console.log(err)
      }
      if (rows.length > 0) {
        let otp2 = rows[0].verification_code
        if (otp == otp2) {
          let values = [email_id, email_id]
          stmt = 'update users set email_verify_status = 1 , modified_by = ? where email_id = ?'
          connection.query(stmt, values, function (err, rows, fields) {
            if (err) {
              console.log(err)
            }
            response.send("success")
          })
        }
        else {
          response.status(401).send("Invalid Otp")
        }
      }
      else {
        response.status(401).send("Invalid User")
      }

    })
  }

});
app.post('/signup/complete', function (req, response) {
  let { email_id, firstname, lastname, phone, country, state, city, address1, address2, pincode } = req.body
  let user_id
  connection.query('select user_id from users where email_id = ?', email_id, function (err, rows, fields) {
    if (err) {
      console.log(err)
      response.status(401).send("Invalid User")
    }
    else {
      user_id = rows[0].user_id;
      let stmt = 'insert into user_info (user_id,first_name,last_name,phone_no,address_line1,address_line2,district,state,country,pincode) values (?,?,?,?,?,?,?,?,?,?)'
      let values = [user_id, firstname, lastname, phone, address1, address2, city, state, country, pincode]
      connection.query(stmt, values, function (err, rows, fields) {
        if (err) {
          if (err.errno === 1062) {
            values = [firstname, lastname, phone, address1, address2, city, state, country, pincode, user_id]
            stmt = 'update user_info set first_name = ?,last_name =? ,phone_no =?,address_line1 =?,address_line2 =? ,district =?,state =?,country =?,pincode =? where user_id = ?'
            connection.query(stmt, values, function (err, rows, fields) {
              if (err) {
                console.log(err)
                response.status(401).send("Invalid User")
              }
              else {
                response.send("success")
              }
            })
          }
          else {
            console.log(err)
            response.status(401).send("Invalid Request")
          }
        }
        else {
          response.send("success")
        }
      })
    }
  })
})
app.post('/signin', (req, response) => {
  let { email_id, password } = req.body
  let hash
  if (email_id && password) {
    connection.query('select password from users where email_id = ?', email_id, function (err, rows, fields) {
      if (err) {
        console.log(err)
        res.status(401).send("Invalid User")
      }
      else if (rows.length < 0) {
        res.status(401).send("Invalid User")
      }
      else {
        hash = rows[0].password
        bcrypt.compare(password, hash, function (err, res) {
          if (err) {
            console.log(err)
          }
          else if (res) {
            connection.query('select session_id from session_mgmt where email_id =?', email_id, function (err, rows, fields) {
              if (err) {
                response.status(401).send("Please Sign Up First")
              }
              else {
                let token = rows[0].session_id
                response.send(token)
              }
            })
          }
          else {
            response.status(401).send("Wrong Password")
          }
        });
      }
    })
  }
  else {
    response.status(401).send("Invalid Input")
  }
})
app.post('/dashboard/user_update', function (req, response) {
  let { firstname, lastname, phone, country, address1, address2, pincode, email_id, oldpassword, confirmpassword } = req.body

})
app.post('/dashboard/user_image', profile_upload.single("user_image"), function (req, response) {

  let { email_id } = req.body
  let user_id
  let path = req.file.path
  if (email_id) {
    connection.query('select user_id from users where email_id = ?', email_id, function (err, rows, fields) {
      if (err) {
        console.log(err)
        response.status(401).send("Invalid User")
      }
      else {
        user_id = rows[0].user_id;
        let stmt = 'insert into user_image_src (user_id,path) values (?,?)'
        let values = [user_id, path]
        connection.query(stmt, values, function (err, rows, fields) {
          if (err) {
            if (err.errno === 1062) {
              values = [path, user_id, user_id]
              stmt = 'update user_image_src set path = ?, modified_by = ? where user_id = ?'
              connection.query(stmt, values, function (err, rows, fields) {
                if (err) {
                  console.log(err)
                  response.status(401).send("Invalid User")
                }
                else {
                  response.send(path)
                }
              })
            }
            else {
              console.log(err)
              response.status(401).send("Invalid Request")
            }
          }
          else {
            response.send(path)
          }
        })
      }
    })
  }
  else {
    response.status(401).send("Invalid Request")
  }
})
app.listen(3000, function () {
  console.log("server stated")
})