import {User} from "../../dao/models/User";
import SignupRequest from "../../dto/requests/user/signup.request";
import SettingsRequest from "../../dto/requests/user/settings.request";
import {getEntityManager} from "../../dao/postgreConnection";
import CompanyService from "./Company.service";
import {Company} from "../../dao/models/Company";
import IdentityService from "../Identity.service";
import AuthRequest from "../../dto/requests/user/auth.request";
import InviteRequest from "../../dto/requests/user/invite.request.dto";
import {MailService} from "../Mail.service";
import FailureResponse from "../../dto/responses/Failure.response";
import AcceptInviteRequest from "../../dto/requests/user/accept-invite.request";
import Errors from "../../common/constants/errors";
import { EntityManager } from "@mikro-orm/core";

const DEFAULT_PASSWORD = 'jkg2!441mmfw__';

export default class UserService {
    private _companyService: CompanyService = new CompanyService();
    private _identityService: IdentityService = new IdentityService();

    public async findUserById(id: number, findIsActive: boolean = true): Promise<User | null> {
        if (id < 0) {
            return null;
        }

        const em = await getEntityManager();
        return em.findOne(User, {id: id, isActive: findIsActive}, ['company', 'roles']);
    }

    public async findUserByCompanyAndId(company: Company, id: number, em?: EntityManager): Promise<User | null> {
        if (id < 0) {
            return null;
        }

        if (!em) {
            em = await getEntityManager();
        }
        
        return em.findOne(User, {company, id: id}, ['company', 'roles', 'subRoles', 'subRoles.users']);
    }

    public async findUserByEmail(email: string): Promise<User | null> {
        if (email.length < 2) {
            return null
        }

        const em = await getEntityManager();
        return em.findOne(User, {email: email});
    }

    public async findUserByInvite(invite: string): Promise<User | null> {
        if (invite.length < 2) {
            return null
        }

        const em = await getEntityManager();
        return em.findOne(User, {invite: invite}, ['company', 'roles']);
    }

    public async createUser(data: SignupRequest): Promise<User | null> {
        let user: User = new User();
        UserService.setUserInfo(user, data);
        user.email = data.email;
        await user.setPassword(data.password);
        user.isCreator = true;
        user.isActive = true;

        const company = await this._companyService.createCompany({
            persist: false,
            isMulti: data.isMultiCompany,
            name: data.companyName
        });

        user.own_company = company;
        user.company = company;

        const em = await getEntityManager();
        await em.persistAndFlush(user);

        user.authToken = await this._identityService.auth(user.id);

        return user;
    }

    public async updateUser(user: User, data: SettingsRequest): Promise<User | null> {
        UserService.setUserInfo(user, data);

        const em = await getEntityManager();
        await em.persistAndFlush(user);

        return user;
    }

    public async auth(data: AuthRequest): Promise<string | null> {
        const user = await this.findUserByEmail(data.email);

        if (!user) {
            return null;
        }

        if (!await user.isMyPassword(data.password)) {
            throw new FailureResponse(400, Errors.INCORRECT_PASSWORD);
        }

        return this._identityService.auth(user.id);
    }

    public async inviteUsers(data: InviteRequest, creator: User) {
        data.emails.forEach(item => {
            UserService.inviteUser(item, creator);
        })
    }

    public async acceptInvite(request: AcceptInviteRequest): Promise<User> {
        const user = await this.findUserByInvite(request.invite);
        if (!user) {
            throw new FailureResponse(404);
        }

        await user.setPassword(request.password);
        user.firstName = request.firstName;
        user.lastName = request.lastName;
        user.isActive = true;
        await (await getEntityManager()).persistAndFlush(user);

        user.authToken = await this._identityService.auth(user.id);

        return user;
    }

    private static setUserInfo(user: User, data: SettingsRequest | SignupRequest) {
        user.lastName = data.lastName;
        user.firstName = data.firstName;
        user.email = data.email;
        user.phone = data.phone;

        if (UserService.IsDefined(data.city)) {
            user.city = data.city;
        }
        if (UserService.IsDefined(data.hobby)) {
            user.hobby = data.hobby;
        }
        if (UserService.IsDefined(data.socialLink)) {
            user.socialLink = data.socialLink;
        }
        if(UserService.IsDefined(data.birthday)) {
            user.birthday = new Date(data.birthday);
        }
        if(UserService.IsDefined(data.language)) {
            user.language = data.language;
        }
    }

    private static async inviteUser(email: string, creator: User): Promise<User> {
        let user: User = new User();

        user.email = email;
        user.firstName = email;
        user.lastName = email;
        await user.setPassword(DEFAULT_PASSWORD);
        user.isCreator = false;
        user.company = creator.company;
        user.isActive = false;

        user.setInviteKey();

        const em = await getEntityManager();
        await em.persistAndFlush(user);

        const mail = new MailService({
            mail: email,
            subject: 'Pulse Invite',
            data: {
                message: `Welcome to Pulse, ${email}`,
                inviteKey: user.invite
            }
        });

        await mail.send();

        return user;
    }

    private static IsDefined(value: any): boolean {
        return !(value === null || value === undefined)
    }
}
