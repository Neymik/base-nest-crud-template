import {Body, CurrentUser, Get, JsonController, OnNull, Post, Put, QueryParam} from "routing-controllers";
import SuccessResponse from "../dto/responses/Base.response";
import SignupRequest from "../dto/requests/user/signup.request";
import SettingsRequest from "../dto/requests/user/settings.request";
import UserService from "../services/bll/User.service";
import FailureResponse from "../dto/responses/Failure.response";
import AuthRequest from "../dto/requests/user/auth.request";
import Errors from "../common/constants/errors";
import {User} from "../dao/models/User";
import InviteRequest from "../dto/requests/user/invite.request.dto";
import AcceptInviteRequest from "../dto/requests/user/accept-invite.request";

@JsonController('/user')
export class UserController {
    private _userService: UserService;

    constructor() {
        this._userService = new UserService();
    }

    @Post('/signup')
    @OnNull(FailureResponse)
    async signup(@Body() body: SignupRequest): Promise<SuccessResponse> {
        const userWithEmail = await this._userService.findUserByEmail(body.email);

        if (userWithEmail !== null) {
            throw new FailureResponse(400, Errors.USER_EXISTED);
        }

        const result = await this._userService.createUser(body);
        if (result) {
            return new SuccessResponse('Success', result.toJSON());
        }

        return null;
    }

    @Post('/auth')
    @OnNull(FailureResponse)
    async auth(@Body() body: AuthRequest): Promise<SuccessResponse> {
        const result = await this._userService.auth(body);
        if (result) {
            return new SuccessResponse('Success', {
                token: result
            })
        }

        throw new FailureResponse(404, Errors.USER_NOT_EXISTS);
    }

    @Get('/me')
    @OnNull(FailureResponse)
    async me(@CurrentUser({ required: true }) user: User,) {
        return new SuccessResponse('Success', user.toJSON());
    }

    @Put('/settings')
    @OnNull(FailureResponse)
    async settings(@CurrentUser({ required: true }) user: User, @Body() body: SettingsRequest): Promise<SuccessResponse> {
        const result = await this._userService.updateUser(user, body);

        if (result) {
            return new SuccessResponse('Success', result.toJSON());
        }

        return null;
    }

    @Post('/invite')
    @OnNull(FailureResponse)
    async invite(@CurrentUser({ required: true }) user: User, @Body() body: InviteRequest) {
        if (!user.isCreator) {
            throw new FailureResponse(403);
        }

        await this._userService.inviteUsers(body, user);
        return new SuccessResponse('Success', true);
    }

    @Get('/get-by-invite')
    @OnNull(FailureResponse)
    async getByInvite(@QueryParam("invite") invite: string) {
        const user = await this._userService.findUserByInvite(invite);
        if (!user) {
            throw new FailureResponse(404, Errors.INVITE_DOES_NOT_EXIST);
        }

        return new SuccessResponse('Success', user.toJSON());
    }

    @Post('/accept-invite')
    @OnNull(FailureResponse)
    async acceptInvite(@Body() body: AcceptInviteRequest) {
        return (await this._userService.acceptInvite(body)).toJSON();
    }
}
