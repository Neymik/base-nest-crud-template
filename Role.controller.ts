import {Body, CurrentUser, Param, Get, JsonController, OnNull, Post, Delete, Put} from "routing-controllers";
import SuccessResponse from "../dto/responses/Base.response";
import AddRoleRequest from "../dto/requests/role/add.request";
import AssignRoleRequest from "../dto/requests/role/assign.request";
import RoleService from "../services/bll/Role.service";
import UserService from "../services/bll/User.service";
import FailureResponse from "../dto/responses/Failure.response";
import Errors from "../common/constants/errors";
import {User} from "../dao/models/User";
import AddSubRoleRequest from "../dto/requests/role/add-subrole.request";
import {body} from "express-validator";
import { getEntityManager } from "../dao/postgreConnection";

@JsonController('/role')
export class RoleController {
    private _roleService: RoleService;
    private _userService: UserService;

    constructor() {
        this._roleService = new RoleService();
        this._userService = new UserService();
    }

    @Post('/company')
    @OnNull(FailureResponse)
    async addRole(@CurrentUser({required: true}) user: User, @Body() body: AddRoleRequest): Promise<SuccessResponse> {
        if (!user.isCreator) {
            throw new FailureResponse(403, Errors.USER_NOT_OWNER);
        }

        const role = await this._roleService.addRole(user.own_company, body);

        return new SuccessResponse('Success', role.toJSON());
    }

    @Delete('/:id/company')
    @OnNull(FailureResponse)
    async deleteRole(@CurrentUser({required: true}) user: User, @Param("id") id: number): Promise<SuccessResponse> {
        if (!user.isCreator) {
            throw new FailureResponse(403, Errors.USER_NOT_OWNER);
        }

        await this._roleService.deleteRoleFromCompany(id, user.company);
        return new SuccessResponse('Success');
    }

    @Put('/:id')
    @OnNull(FailureResponse)
    async updateRole(@CurrentUser({required: true}) user: User, @Param("id") id: number, @Body() body: AddRoleRequest): Promise<SuccessResponse> {
        if (!user.isCreator) {
            throw new FailureResponse(403, Errors.USER_NOT_OWNER);
        }

        const role = await this._roleService.getRoleByCompanyAndId(user.own_company, id);

        if (!role) {
            throw new FailureResponse(404, Errors.ROLE_NOT_EXISTS);
        }

        await this._roleService.updateRole(role, body);
        return new SuccessResponse('Success', role.toJSON());
    }

    @Get('/company')
    @OnNull(FailureResponse)
    async getRoles(@CurrentUser({required: true}) user: User) {
        if (!user.isCreator) {
            throw new FailureResponse(403, Errors.USER_NOT_OWNER);
        }

        const roles = await this._roleService.getRolesByCompany(user.own_company);

        return new SuccessResponse('Success', [
            roles[0].map(r => r.toJSON()),
            roles[1]
        ]);
    }

    @Post('/user')
    @OnNull(FailureResponse)
    async assignRole(@CurrentUser({required: true}) user: User, @Body() body: AssignRoleRequest): Promise<SuccessResponse> {
        if (!user.isCreator) {
            throw new FailureResponse(403, Errors.USER_NOT_OWNER);
        }

        const findedUser = await this._userService.findUserByCompanyAndId(user.own_company, body.userId);
        if (!findedUser) {
            throw new FailureResponse(404, Errors.USER_NOT_EXISTS);
        }
        const role = await this._roleService.getRoleByCompanyAndId(user.own_company, body.roleId);
        if (!role) {
            throw new FailureResponse(404, Errors.ROLE_NOT_EXISTS);
        }

        await this._roleService.assignRoleToUser(role, findedUser);
        return new SuccessResponse('Success', {message: "added"});
    }

    @Delete('/user')
    @OnNull(FailureResponse)
    async removeRoleFromUser(@CurrentUser({required: true}) user: User, @Body() body: AssignRoleRequest): Promise<SuccessResponse> {
        if (!user.isCreator) {
            throw new FailureResponse(403, Errors.USER_NOT_OWNER);
        }

        const em = await getEntityManager();

        const findedUser = await this._userService.findUserByCompanyAndId(user.own_company, body.userId, em);
        if (!findedUser) {
            throw new FailureResponse(404, Errors.USER_NOT_EXISTS);
        }
        const role = await this._roleService.getRoleByCompanyAndId(user.own_company, body.roleId, em);
        if (!role) {
            throw new FailureResponse(404, Errors.ROLE_NOT_EXISTS);
        }

        await this._roleService.removeRoleFromUser(role, findedUser, em);
        return new SuccessResponse('Success');
    }

    @Post('/sub-role/user')
    @OnNull(FailureResponse)
    async assignSubRole(@CurrentUser({required: true}) user: User, @Body() body: AssignRoleRequest): Promise<SuccessResponse> {
        if (!user.isCreator) {
            throw new FailureResponse(403, Errors.USER_NOT_OWNER);
        }

        const findedUser = await this._userService.findUserByCompanyAndId(user.own_company, body.userId);
        if (!findedUser) {
            throw new FailureResponse(404, Errors.USER_NOT_EXISTS);
        }
        const subRole = await this._roleService.getSubRoleByCompanyAndId(user.own_company, body.roleId);
        if (!subRole) {
            throw new FailureResponse(404, Errors.ROLE_NOT_EXISTS);
        }
        const parentRole = await this._roleService.getRoleBySubRoleIdAndUser(subRole, findedUser);
        if (!parentRole) {
            throw new FailureResponse(404, Errors.NO_PARRENT_ROLE);
        }

        await this._roleService.assignSubRoleToUser(subRole, findedUser);
        return new SuccessResponse('Success');
    }

    @Delete('/sub-role/user')
    @OnNull(FailureResponse)
    async removeSubRoleFromUser(@CurrentUser({required: true}) user: User, @Body() body: AssignRoleRequest): Promise<SuccessResponse> {
        if (!user.isCreator) {
            throw new FailureResponse(403, Errors.USER_NOT_OWNER);
        }

        const em = await getEntityManager();

        const findedUser = await this._userService.findUserByCompanyAndId(user.own_company, body.userId, em);
        if (!findedUser) {
            throw new FailureResponse(404, Errors.USER_NOT_EXISTS);
        }
        const subRole = await this._roleService.getSubRoleByCompanyAndId(user.own_company, body.roleId, em);
        if (!subRole) {
            throw new FailureResponse(404, Errors.ROLE_NOT_EXISTS);
        }

        await this._roleService.removeSubRoleFromUser(subRole, findedUser, em);
        return new SuccessResponse('Success');
    }

    @Post('/:id/sub-role')
    @OnNull(FailureResponse)
    async createSubRole(
        @CurrentUser({required: true}) user: User,
        @Param("id") id: number,
        @Body() request: AddSubRoleRequest
    ) {
        if (!user.isCreator) {
            throw new FailureResponse(403, Errors.USER_NOT_OWNER);
        }

        const role = await this._roleService.getRoleByCompanyAndId(user.own_company, id);

        if (!role) {
            throw new FailureResponse(404, Errors.ROLE_NOT_EXISTS);
        }

        return this._roleService.createSubRole(role, request).then(subrole => subrole.toJSON());
    }

    @Delete('/sub-role/:id')
    @OnNull(FailureResponse)
    async deleteSubRole(@CurrentUser({required: true}) user: User, @Param("id") id: number): Promise<SuccessResponse> {
        if (!user.isCreator) {
            throw new FailureResponse(403, Errors.USER_NOT_OWNER);
        }

        await this._roleService.deleteSubRole(id);
        return new SuccessResponse('Success');
    }

    @Put('/sub-role/:id')
    @OnNull(FailureResponse)
    async updateSubRole(@CurrentUser({required: true}) user: User, @Param("id") id: number, @Body() body: AddSubRoleRequest): Promise<SuccessResponse> {
        if (!user.isCreator) {
            throw new FailureResponse(403, Errors.USER_NOT_OWNER);
        }
        
        const subRole = await this._roleService.getSubRoleByCompanyAndId(user.own_company, id);

        if (!subRole) {
            throw new FailureResponse(404, Errors.ROLE_NOT_EXISTS);
        }

        await this._roleService.updateSubRole(subRole, body);
        return new SuccessResponse('Success', subRole.toJSON());
    }
}
