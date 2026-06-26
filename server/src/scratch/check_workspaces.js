import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Workspace from '../models/workspace.model.js';
import WorkspaceMember from '../models/workspaceMember.model.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const check = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const users = await User.find({});
    console.log('--- USERS ---');
    console.log(users.map(u => ({ id: u._id, email: u.email, firstName: u.firstName, lastName: u.lastName })));

    const workspaces = await Workspace.find({});
    console.log('--- WORKSPACES ---');
    console.log(workspaces);

    const members = await WorkspaceMember.find({});
    console.log('--- WORKSPACE MEMBERS ---');
    console.log(members);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
    console.log('Closed connection');
  }
};

check();
