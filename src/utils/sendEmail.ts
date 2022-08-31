import nodeMailer from 'nodemailer'

  
export const sendMail = async(to: string , html: string) => {

    const testAcc = await nodeMailer.createTestAccount()
    let transporter = nodeMailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
            user: testAcc.user,
            pass: testAcc.pass,
        }
    })

    let info = await transporter.sendMail({
        from: "Host , zulfuqarli.ikram0101@gmail.com",
        to,
        subject: "Change password",
        html, 
    })

    console.log("Info : " , info)
    console.log("Url : " , nodeMailer.getTestMessageUrl(info))

}
