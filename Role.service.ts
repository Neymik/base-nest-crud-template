import {Role} from "../../dao/models/Role";
import {Company} from "../../dao/models/Company";
import {User} from "../../dao/models/User";
import AddRoleRequest from "../../dto/requests/role/add.request";
import {getEntityManager} from "../../dao/postgreConnection";
import AddSubRoleRequest from "../../dto/requests/role/add-subrole.request";
import {SubRole} from "../../dao/models/SubRole";
import { EntityManager } from "@mikro-orm/core";

export default class RoleService {
    public async addRole(company: Company, data: AddRoleRequest): Promise<Role> {
        const role = new Role();
        role.company = company;
        role.name = data.name;
        role.isLeader = data.isLeader;

        const em = await getEntityManager();
        await em.persistAndFlush(role);

        return role;
    }

    public async updateRole(role: Role, data: AddRoleRequest): Promise<Role> {
        role.name = data.name;
        role.isLeader = data.isLeader;

        const em = await getEntityManager();
        await em.persistAndFlush(role);
        return role;
    }

    public async getRolesByCompany(company: Company): Promise<[Role[], number]> {
        const em = await getEntityManager();
        return em.findAndCount(Role, {company}, ['childRoles']);
    }

    public async getRoleByCompanyAndId(company: Company, roleId: number, em?: EntityManager): Promise<Role | null> {
        if (!em) {
            em = await getEntityManager();
        }
        return em.findOne(Role, {company, id: roleId}, ['users', 'childRoles']);
    }

    public async getSubRoleByCompanyAndId(company: Company, subRoleId: number, em?: EntityManager): Promise<SubRole | null> {
        if (!em) {
            em = await getEntityManager();
        }
        return em.findOne(SubRole, {parentRole: {company}, id: subRoleId}, ['users']);
    }

    public async getRoleBySubRoleIdAndUser(subRole: SubRole, user: User): Promise<Role | null> {
        const em = await getEntityManager();
        return em.findOne(Role, {id: subRole.parentRole.id, users: user});
    }

    public async assignRoleToUser(role: Role, user: User): Promise<User> {
        role.users.add(user);
        user.roles.add(role);
        const em = await getEntityManager();
        await em.persistAndFlush([user, role]);
        return user;
    }

    public async assignSubRoleToUser(subRole: SubRole, user: User): Promise<User> {
        const em = await getEntityManager();

        subRole.users.add(user);
        user.subRoles.add(subRole);
        
        await em.persistAndFlush([user, subRole]);
        return user;
    }

    public async deleteRoleFromCompany(roleId: number, company: Company): Promise<void> {
        const em = await getEntityManager();
        const role = await em.findOne(Role, {company, id: roleId});

        if (!role) {
            return;
        }

        else return em.remove(role).flush();
    }

    public async deleteSubRole(subRoleId: number) {
        const em = await getEntityManager();
        const role = await em.findOne(SubRole, {id: subRoleId});

        if (!role) {
            return;
        }

        else return em.remove(role).flush();
    }

    public async removeRoleFromUser(role: Role, user: User, em: EntityManager) {

        // Также удаляем все дочерние роли
        const subRoles = user.subRoles.getItems();
        const childRoles = role.childRoles.getItems();

        const subRolesToRemove = subRoles.filter(subRole => 
            childRoles.some(childRole => subRole.id == childRole.id));

        for (let subRole of subRolesToRemove) {
            user.subRoles.remove(subRole);
            subRole.users.remove(user);
        }

        user.roles.remove(role);
        role.users.remove(user);

        em.persist(subRoles);
        await em.persistAndFlush([user, role]);
    }

    public async removeSubRoleFromUser(subRole: SubRole, user: User, em: EntityManager) {

        user.subRoles.remove(subRole);
        subRole.users.remove(user);

        await em.persistAndFlush([user, subRole]);
    }

    public async createSubRole(parent: Role, body: AddSubRoleRequest):Promise<SubRole> {
        const em = await getEntityManager();

        const subRole = new SubRole();
        subRole.name = body.name;
        subRole.parentRole = parent;

        await em.persistAndFlush(subRole);

        return subRole;
    }

    public async updateSubRole(subRole: SubRole, data: AddSubRoleRequest): Promise<SubRole> {
        subRole.name = data.name;
        const em = await getEntityManager();
        await em.persistAndFlush(subRole);

        return subRole;
    }

}
