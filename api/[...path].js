
import adminDeleteUser from './_lib/admin-delete-user.js';
import adminUsers from './_lib/admin-users.js';
import adminVerify from './_lib/admin-verify.js';

import agentShop from './_lib/agent-shop.js';
import agentWithdrawals from './_lib/agent-withdrawals.js';

import kingflexyPackages from './_lib/kingflexy-packages.js';
import kingflexyPurchase from './_lib/kingflexy-purchase.js';
import kingflexyStatus from './_lib/kingflexy-status.js';

const handlers = {
  'admin/delete-user': adminDeleteUser,
  'admin/users': adminUsers,
  'admin/verify': adminVerify,

  'agent/shop': agentShop,
  'agent/withdrawals': agentWithdrawals,

  'kingflexy/packages': kingflexyPackages,
  'kingflexy/purchase': kingflexyPurchase,
  'kingflexy/status': kingflexyStatus
};

export default function handler(req, res) {
  const path = Array.isArray(req.query?.path)
    ? req.query.path.join('/')
    : String(req.query?.path || '');

  const selected = handlers[path];

  if (!selected) {
    return res.status(404).json({
      error: 'API endpoint not found.'
    });
  }

  return selected(req, res);
}
