#!/usr/bin/env bash
# 在服务器生成项目2 Deploy Key，并配置 GitHub SSH
# 用法：bash scripts/server-ssh-setup.sh
set -euo pipefail

KEY_DIR="${HOME}/.ssh"
KEY_FILE="${KEY_DIR}/guanzi2_deploy"
HOST_ALIAS="github.com-guanzi2"

mkdir -p "$KEY_DIR"
chmod 700 "$KEY_DIR"

if [ ! -f "$KEY_FILE" ]; then
  echo "[ssh] generating deploy key: $KEY_FILE"
  ssh-keygen -t ed25519 -C "guanzi2-deploy@$(hostname)" -f "$KEY_FILE" -N ""
else
  echo "[ssh] key already exists: $KEY_FILE"
fi

CFG="$KEY_DIR/config"
if ! grep -q "Host ${HOST_ALIAS}" "$CFG" 2>/dev/null; then
  cat >> "$CFG" <<EOF

Host ${HOST_ALIAS}
  HostName github.com
  User git
  IdentityFile ${KEY_FILE}
  IdentitiesOnly yes
  # 若 22 不通：HostName ssh.github.com + Port 443
  Port 22
EOF
  chmod 600 "$CFG"
  echo "[ssh] wrote Host ${HOST_ALIAS} to $CFG"
fi

echo ""
echo "========== 把下面整段公钥加到 GitHub =========="
echo "仓库 ErHaSmile/guangzi2 → Settings → Deploy keys → Add deploy key"
echo "Title: ecs-guanzi2"
echo "Allow write access: 不用勾（只拉代码）"
echo ""
cat "${KEY_FILE}.pub"
echo ""
echo "================================================"
echo ""
echo "添加完成后测试："
echo "  ssh -T git@${HOST_ALIAS}"
echo "应看到：Hi ErHaSmile/guangzi2! You've successfully authenticated..."
echo ""
echo "然后 clone："
echo "  mkdir -p /opt/sites"
echo "  git clone git@${HOST_ALIAS}:ErHaSmile/guangzi2.git /opt/sites/guanzi_2"
echo ""
echo "若 22 端口不通，编辑 ~/.ssh/config，把该 Host 改成："
echo "  HostName ssh.github.com"
echo "  Port 443"
