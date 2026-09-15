import { Injectable } from '@nestjs/common';

import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import Mail from 'nodemailer/lib/mailer';

import { mailer_fromEmail, mailer_transportConfig } from '../../../config/mail_credentials';

@Injectable()
export class MailService {
    constructor () { }

    private _removeTags (str: string, replaceStr: string = '') {
        const dividerRES: string = '[ \n\r]';
        const tagNameRES: string = '[a-zA-Z0-9]+';
        const attrNameRES: string = '[a-zA-Z]+';

        const attrValueRES: string = "(?:\".+?\"|'.+?'|[^ >]+)";

        const attrRES: string = `(${ attrNameRES })(?:${ dividerRES }*=${ dividerRES }*(${ attrValueRES }))?`;
        const openingTagRES: string = `<(${ tagNameRES })((?:${ dividerRES }+${ attrRES })*)${ dividerRES }*/?>`;
        const closingTagRES: string = `</(${ tagNameRES })${ dividerRES }*>`;

        const openingTagRE: RegExp = new RegExp(openingTagRES, "g");
        const closingTagRE: RegExp = new RegExp(closingTagRES, "g");

        if ( typeof str === 'string' && str.indexOf("<") !== -1 ) {
            str = str.replace(openingTagRE, replaceStr);
            str = str.replace(closingTagRE, replaceStr);
        }
    
        return str;
    }

    public sendEmail (recipientEmail: string, subject: string, body: string): Promise<SMTPTransport.SentMessageInfo> {
        return new Promise((resolve, reject) => {
            const transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> = nodemailer.createTransport(mailer_transportConfig);
    
            let text: string = body;
            let html: string | undefined = undefined;

            const textWOTags: string = this._removeTags(text);
    
            if ( textWOTags !== text ) {
                text = textWOTags;
                html = body;
            }
    
            const message: Mail.Options = {
                from: mailer_fromEmail,
                to: recipientEmail,
                subject: subject,
                text: text,
                html: html,
            };
    
            transporter.sendMail(message, (err, info) => {
                if ( err ) reject(err);
                else resolve(info);
            });
        });
    }
}