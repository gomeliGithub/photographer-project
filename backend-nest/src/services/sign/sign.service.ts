import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { Response } from 'express';

import * as bcrypt from 'bcrypt';

import { ClientModule } from '../../modules/client.module';

import { PrismaService } from '../../../prisma/prisma.service';
import { AppService } from '../../app.service';
import { JwtControlService } from '../../services/sign/jwt-control.service';
import { ClientService } from '../client/client.service';

import { generate__secure_fgp } from './sign.generateKeys';

import { IRequest, IRequestBody } from '@photographer-project/types';
import { IClientSignData, IJWTPayload } from '@photographer-project/types';
import { IAdminWithoutRelationFields, IMemberWithoutRelationFields } from '@photographer-project/types';

@Injectable()
export class SignService {
    constructor (
        private readonly _prisma: PrismaService,
        private readonly _jwtService: JwtService,
        private readonly _configService: ConfigService,

        private readonly _appService: AppService,
        private readonly _jwtControlService: JwtControlService
    ) { }
    /**
        * Validate client JWT or (and) client password.
        * 
        * @param   request Currently request object.
        * @param   requiredClientTypes Client types required to access the current operation.
        * @param   throwError In case of a validation error, throw an error or not.
        * 
        * @returns Result of validation.
    */
    public async validateClient (request: IRequest, requiredClientTypes: string[], throwError = true): Promise<boolean> {
        if ( request.url === '/api/sign/in' ) {
            const token: string | undefined = this._jwtControlService.extractTokenFromHeader(request, false);

            const requestBody: IRequestBody = request.body;

            const clientLogin: string = ( requestBody.sign?.clientData as IClientSignData ).login.trim();
            const clientPassword: string = ( requestBody.sign?.clientData as IClientSignData ).password.trim();

            request.activeClientData = this._getActiveClientData(await this._clientSignDataValidate(request, clientLogin, clientPassword));

            if ( token && await this._jwtControlService.checkTokenIsExists(token) ) await this._jwtControlService.addRevokedToken(token);

            return true;
        } else {
            const token: string | undefined = this._jwtControlService.extractTokenFromHeader(request); 

            const validatedClientPayload: IJWTPayload | null = token ? await this._jwtControlService.tokenValidate(request, token, throwError) : null;
            const clientType: string | null = validatedClientPayload !== null ? validatedClientPayload.type : null;
            const clientLogin: string | null = validatedClientPayload !== null ? validatedClientPayload.login : null;

            const clientServiceRef: ClientService = await this._appService.getServiceRef(ClientModule, ClientService);
            const existingClientData: IAdminWithoutRelationFields | IMemberWithoutRelationFields | null = await clientServiceRef.checkAnyClientDataExists(clientLogin);

            if ( existingClientData === null ) {
                if ( throwError ) throw new UnauthorizedException(`${ request.url } "ValidateClient - client instance does not exists, login - ${ validatedClientPayload !== null ? validatedClientPayload.login : '' }"`);
                else return false;
            }

            request.activeClientData = this._getActiveClientData(existingClientData);

            return requiredClientTypes.some(requiredClientType => requiredClientType === clientType);
        }
    }
    /**
        * Client registration.
        * 
        * @param   request Currently request object.
        * @param   clientData Client data for registration.
    */
    public async signUp (request: IRequest, clientData: IClientSignData): Promise<void> {
        const { login, password, fullName, email } = clientData;

        const clientServiceRef: ClientService = await this._appService.getServiceRef(ClientModule, ClientService);
        const existingClientData: IAdminWithoutRelationFields | IMemberWithoutRelationFields | null = await clientServiceRef.checkAnyClientDataExists(login.trim());
        
        if ( existingClientData !== null ) throw new UnauthorizedException(`${ request.url } "SignUp - client instance is exists"`);
        
        const passwordHash: string = await bcrypt.hash(password.trim(), parseInt(process.env['CLIENT_PASSWORD_BCRYPT_SALTROUNDS'] as string, 10));

        await this._prisma.member.create({ 
            data: {
                login: login.trim(),
                password: passwordHash,
                fullName: ( fullName as string ).trim(),
                email: ( email as string ).trim()
            }
        });
    }
    /**
        * Client authorization.
        * 
        * @param   request Currently request object.
        * @param   response Currently response object.
        * @param   clientLocale Current client language.
        * 
        * @returns JWT for authentication.
    */
    public async signIn (request: IRequest, response: Response, clientLocale: string): Promise<string> {
        const payload: IJWTPayload = {
            id: ( request.activeClientData as IJWTPayload ).id,
            login: ( request.activeClientData as IJWTPayload ).login,
            type: ( request.activeClientData as IJWTPayload ).type,
            locale: process.env['CLIENT_DEFAULT_LOCALE'] as string,
            fullName: ( request.activeClientData as IJWTPayload ).fullName,
            email: ( request.activeClientData as IJWTPayload ).email,
            signUpDate: ( request.activeClientData as IJWTPayload ).signUpDate,
            __secure_fgpHash: ""
        }

        const { __secure_fgp, __secure_fgpHash } = generate__secure_fgp();

        payload.__secure_fgpHash = __secure_fgpHash;

        const clientServiceRef: ClientService = await this._appService.getServiceRef(ClientModule, ClientService);
        await clientServiceRef.registerClientLastActivityLoginTime(request.activeClientData as IJWTPayload, 'signInDate');
        await clientServiceRef.registerClientLastActivityLoginTime(request.activeClientData as IJWTPayload, 'activityDate');

        const access_token: string = await this._jwtService.signAsync(payload, {
            secret: this._configService.get<string>('JWT_SECRETCODE') as string
        });

        await this._jwtControlService.saveToken(access_token);

        response.cookie('__secure_fgp', __secure_fgp, this._appService.cookieSerializeOptions);

        if ( !clientLocale ) response.cookie('locale', process.env['CLIENT_DEFAULT_LOCALE'], this._appService.cookieSerializeOptions);

        return access_token;
    }
    /**
        * Client logout.
        * 
        * @param   request Currently request object.
    */
    public async signOut (request: IRequest): Promise<void> {
        const token: string | undefined = this._jwtControlService.extractTokenFromHeader(request);

        if ( !token || token === '' ) throw new UnauthorizedException(`${ request.url } "SignOut - invalid or does not exists token"`);

        return this._jwtControlService.addRevokedToken(token);
    }
    /**
        * Get active client via JWT.
        * 
        * @param   request Currently request object.
        * @param   response Currently response object.
        * @param   clientLocale Current client language.
        * 
        * @returns JWT payload.
    */
    public async getActiveClient (request: IRequest, response?: Response, clientLocale?: string): Promise<IJWTPayload> {
        const token: string | undefined = this._jwtControlService.extractTokenFromHeader(request);

        let validatedClientPayload: IJWTPayload | null = null;

        try {
            if ( token ) validatedClientPayload = await this._jwtControlService.tokenValidate(request, token, true);
        } catch { }

        if ( validatedClientPayload === null || !token || token === '' ) {
            if ( response && ( !clientLocale || clientLocale === '' ) ) response.cookie('locale', process.env['CLIENT_DEFAULT_LOCALE'], this._appService.cookieSerializeOptions);

            validatedClientPayload = {
                id: null,
                login: null,
                type: null,
                fullName: null,
                email: null,
                signUpDate: null,
                locale: clientLocale && clientLocale !== '' ? clientLocale : null 
            };

            return validatedClientPayload as IJWTPayload;
        }
        
        if ( validatedClientPayload ) {
            const clientServiceRef: ClientService = await this._appService.getServiceRef(ClientModule, ClientService);
            const existingClientData: IAdminWithoutRelationFields | IMemberWithoutRelationFields | null = await clientServiceRef.checkAnyClientDataExists(validatedClientPayload.login as string);

            if ( existingClientData === null ) throw new UnauthorizedException(`${ request.url } "GetActiveClient - client instance does not exists"`);
        }
        
        delete validatedClientPayload.exp;
        delete validatedClientPayload.iat;

        return validatedClientPayload;
    }
    /**
        * Validate client sign data.
        * 
        * @param   request Currently request object.
        * @param   clientLogin Client login for sign.
        * @param   clientPassword Client password for sign.
        * 
        * @returns Client data without relations.
    */
    private async _clientSignDataValidate (request: IRequest, clientLogin: string, clientPassword: string): Promise<IAdminWithoutRelationFields | IMemberWithoutRelationFields> {
        const clientServiceRef: ClientService = await this._appService.getServiceRef(ClientModule, ClientService);
        const existingClientData: IAdminWithoutRelationFields | IMemberWithoutRelationFields | null = await clientServiceRef.checkAnyClientDataExists(clientLogin);

        if ( existingClientData === null ) throw new UnauthorizedException(`${ request.url } "_clientSignDataValidate - client instance does not exists"`);

        const passwordIsValid: boolean = await bcrypt.compare(clientPassword, existingClientData.password);
        if ( !passwordIsValid ) throw new UnauthorizedException(`${ request.url } "_clientSignDataValidate - client password invalid"`);

        return existingClientData;
    }
    /**
        * Get active client data from validated client data.
        * 
        * @param   validatedClientData Client data without relations.
        * 
        * @returns Active client data.
    */
    private _getActiveClientData (validatedClientData: IAdminWithoutRelationFields | IMemberWithoutRelationFields): IJWTPayload {
        const activeClientData: IJWTPayload = {
            id: validatedClientData.id,
            login: validatedClientData.login,
            type: validatedClientData.type,
            fullName: validatedClientData.fullName,
            email: validatedClientData.email,
            locale: null,
            signUpDate: validatedClientData.signUpDate
        };

        return activeClientData;
    }
}