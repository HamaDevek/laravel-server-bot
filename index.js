const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const fs = require("fs").promises;

// Replace with your Telegram bot token
const bot = new Telegraf("7767894948:AAGPJ1cQuPCOn42XjgzL3b9YSS06n9Kh1ek");

// Allowed Telegram user IDs (for security)
const ALLOWED_USERS = [
  // Add your Telegram user ID and other authorized users
  // Example: 123456789
];

// Check if user is authorized
const isAuthorized = (ctx) => {
  const userId = ctx.from?.id;
  return ALLOWED_USERS.includes(userId);
};

// Middleware to check authorization
bot.use((ctx, next) => {
  if (!isAuthorized(ctx)) {
    return ctx.reply("⛔ You are not authorized to use this bot.");
  }
  return next();
});

// Helper function to execute shell commands and send output
async function executeCommand(ctx, command, successMessage) {
  try {
    ctx.reply(`🔄 Executing: ${command}`);
    const { stdout, stderr } = await execPromise(command);

    // Split output if it's too long for Telegram
    const maxLength = 4000;
    if (stdout.length > maxLength) {
      for (let i = 0; i < stdout.length; i += maxLength) {
        await ctx.reply(stdout.substring(i, i + maxLength));
      }
    } else if (stdout) {
      await ctx.reply(stdout);
    }

    if (stderr) {
      await ctx.reply(`⚠️ stderr: ${stderr}`);
    }

    await ctx.reply(`✅ ${successMessage}`);
    return true;
  } catch (error) {
    await ctx.reply(`❌ Error: ${error.message}`);
    return false;
  }
}

// Helper function to create Nginx configuration
async function createNginxConfig(domain, phpVersion) {
  const config = `
server {
    listen 80;
    listen [::]:80;
    server_name ${domain};
    root /var/www/html/${domain}/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \\.php$ {
        fastcgi_pass unix:/var/run/php/php${phpVersion}-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\\.(?!well-known).* {
        deny all;
    }
}`;

  await fs.writeFile(`/etc/nginx/sites-available/${domain}`, config);
  return config;
}

// Random password generator
function generatePassword(length = 16) {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

// Start command
bot.command("start", (ctx) => {
  ctx.reply(`
Welcome to Laravel Server Management Bot! 🚀

Available commands:
1. Server Initialization
   /init_server - Show server initialization options

2. Project Management
   /manage_project - Show project management options

3. Project Maintenance
   /maintain_project - Perform maintenance on a project

Type any command to get started.
  `);
});

// Help command
bot.command("help", (ctx) => {
  ctx.reply(`
Laravel Server Management Bot Commands:

🔧 Server Initialization:
/install_php - Install PHP (select version)
/install_nginx - Install and configure Nginx
/install_npm - Install Node.js and NVM
/install_mariadb - Install MariaDB Server

📁 Project Management:
/create_project - Create new Laravel project
/configure_project - Configure Nginx and database for a project

🔄 Project Maintenance:
/maintain_project - Update and optimize a project

Use /init_server, /manage_project, or /maintain_project for guided options.
  `);
});

// Server Initialization Menu
bot.command("init_server", (ctx) => {
  ctx.reply(`
🔧 Server Initialization Options:

1. /install_php - Install PHP with Composer
2. /install_nginx - Install Nginx and configure firewall
3. /install_npm - Install Node.js and NVM
4. /install_mariadb - Install MariaDB Server

Select an option to proceed.
  `);
});

// PHP Installation with version selection
bot.command("install_php", (ctx) => {
  ctx.reply("Select PHP version to install:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "PHP 8.1", callback_data: "php_8.1" },
          { text: "PHP 8.2", callback_data: "php_8.2" },
        ],
        [
          { text: "PHP 8.3", callback_data: "php_8.3" },
          { text: "PHP 8.4", callback_data: "php_8.4" },
        ],
      ],
    },
  });
});

bot.action(/php_(\d+\.\d+)/, async (ctx) => {
  const version = ctx.match[1];
  await ctx.reply(`Installing PHP ${version} with Composer...`);

  const commands = [
    "sudo apt-get update",
    "sudo apt-get install -y software-properties-common",
    "sudo add-apt-repository -y ppa:ondrej/php",
    "sudo apt-get update",
    `sudo apt-get install -y php${version} php${version}-mbstring php${version}-gettext php${version}-zip php${version}-fpm php${version}-curl php${version}-mysql php${version}-gd php${version}-cgi php${version}-soap php${version}-sqlite3 php${version}-xml php${version}-redis php${version}-bcmath php${version}-imagick php${version}-intl`,
    "sudo apt-get install -y git composer",
  ];

  for (const command of commands) {
    await executeCommand(ctx, command, `Command completed: ${command}`);
  }

  await ctx.reply(`✅ PHP ${version} and Composer installed successfully!`);
});

// Nginx Installation
bot.command("install_nginx", async (ctx) => {
  await ctx.reply("Installing Nginx and configuring firewall...");

  const commands = [
    "sudo apt-get update",
    "sudo apt-get install -y nginx",
    'sudo ufw allow "Nginx Full"',
    "sudo ufw allow 22",
    "sudo ufw allow 80",
    "sudo ufw allow 443",
    "sudo systemctl enable nginx",
    "sudo systemctl start nginx",
  ];

  for (const command of commands) {
    await executeCommand(ctx, command, `Command completed: ${command}`);
  }

  await ctx.reply("✅ Nginx installed and firewall configured!");
});

// Node.js and NVM Installation
bot.command("install_npm", async (ctx) => {
  await ctx.reply("Installing Node.js and NVM...");

  const commands = [
    "sudo apt-get update",
    "sudo apt-get install -y curl",
    "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash",
    'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh" && [ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion" && nvm install --lts',
    "npm install -g npm@latest",
  ];

  for (const command of commands) {
    await executeCommand(ctx, command, `Command completed: ${command}`);
  }

  await ctx.reply(
    "✅ Node.js and NVM installed! You may need to restart your terminal to use NVM."
  );
});

// MariaDB Installation
bot.command("install_mariadb", async (ctx) => {
  await ctx.reply("Installing MariaDB Server...");

  const commands = [
    "sudo apt-get update",
    "sudo apt-get install -y mariadb-server",
    "sudo systemctl start mariadb.service",
    "sudo systemctl enable mariadb.service",
  ];

  for (const command of commands) {
    await executeCommand(ctx, command, `Command completed: ${command}`);
  }

  await ctx.reply(`
✅ MariaDB installed!

⚠️ Important: You should secure your MariaDB installation manually:
Run: sudo mysql_secure_installation

Follow the prompts to:
- Set root password
- Remove anonymous users
- Disallow root login remotely
- Remove test database
- Reload privilege tables
  `);
});

// Project Management Menu
bot.command("manage_project", (ctx) => {
  ctx.reply(`
📁 Project Management Options:

1. /create_project - Create a new Laravel project
2. /configure_project - Configure Nginx and database

Select an option to proceed.
  `);
});

// Create Project
bot.command("create_project", (ctx) => {
  ctx.session = ctx.session || {};
  ctx.session.createProject = { step: 1 };

  ctx.reply(`
Please provide the following information:

1. What is the domain name? (e.g., example.com)
  `);
});

bot.on(message("text"), async (ctx) => {
  const session = ctx.session || {};

  // Handle create project conversation
  if (session.createProject) {
    const step = session.createProject.step;

    if (step === 1) {
      // Save domain
      session.createProject.domain = ctx.message.text;
      session.createProject.step = 2;

      ctx.reply(`
2. What is the Git repository URL? (e.g., git@github.com:username/repo.git)
      `);
    } else if (step === 2) {
      // Save git repo
      session.createProject.gitRepo = ctx.message.text;
      session.createProject.step = 3;

      ctx.reply("3. Which PHP version do you want to use?", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "PHP 8.1", callback_data: "create_php_8.1" },
              { text: "PHP 8.2", callback_data: "create_php_8.2" },
            ],
            [
              { text: "PHP 8.3", callback_data: "create_php_8.3" },
              { text: "PHP 8.4", callback_data: "create_php_8.4" },
            ],
          ],
        },
      });
    }
  }
});

bot.action(/create_php_(\d+\.\d+)/, async (ctx) => {
  const version = ctx.match[1];
  const session = ctx.session || {};

  if (!session.createProject) {
    return ctx.reply(
      "❌ Session expired. Please start again with /create_project"
    );
  }

  session.createProject.phpVersion = version;
  const { domain, gitRepo, phpVersion } = session.createProject;

  await ctx.reply(`
Creating Laravel project with:
- Domain: ${domain}
- Git repo: ${gitRepo}
- PHP version: ${phpVersion}

This process may take some time. Please wait...
  `);

  // Generate random password for database
  const dbPassword = generatePassword();
  const dbName = domain.replace(/[^a-z0-9]/gi, "_");
  const dbUser = dbName.substring(0, 16); // Truncate if too long

  try {
    // Step 1: Create directory and clone project
    await executeCommand(
      ctx,
      `sudo mkdir -p /var/www/html/${domain} && sudo chown -R $USER:$USER /var/www/html/${domain}`,
      "Directory created"
    );

    await executeCommand(
      ctx,
      `cd /var/www/html/${domain} && git clone ${gitRepo} . && cp .env.example .env`,
      "Project cloned and .env prepared"
    );

    // Step 2: Create database and user
    await executeCommand(
      ctx,
      `sudo mysql -e "CREATE DATABASE ${dbName}; CREATE USER '${dbUser}'@'localhost' IDENTIFIED BY '${dbPassword}'; GRANT ALL PRIVILEGES ON ${dbName}.* TO '${dbUser}'@'localhost'; FLUSH PRIVILEGES;"`,
      "Database and user created"
    );

    // Step 3: Update .env file with database credentials
    await executeCommand(
      ctx,
      `cd /var/www/html/${domain} && sed -i 's/DB_DATABASE=.*/DB_DATABASE=${dbName}/g' .env && sed -i 's/DB_USERNAME=.*/DB_USERNAME=${dbUser}/g' .env && sed -i 's/DB_PASSWORD=.*/DB_PASSWORD=${dbPassword}/g' .env`,
      "Environment file updated"
    );

    // Step 4: Create and enable Nginx configuration
    const nginxConfig = await createNginxConfig(domain, phpVersion);
    await executeCommand(
      ctx,
      `sudo ln -s /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/${domain} && sudo nginx -t && sudo systemctl reload nginx`,
      "Nginx configured"
    );

    // Step 5: Install dependencies and set up Laravel
    await executeCommand(
      ctx,
      `cd /var/www/html/${domain} && composer install && php artisan key:generate && npm install && npm run build && php artisan migrate && php artisan storage:link && php artisan optimize`,
      "Laravel dependencies installed and configured"
    );

    // Step 6: Set proper permissions
    await executeCommand(
      ctx,
      `sudo chown -R www-data:www-data /var/www/html/${domain} && sudo chmod -R 755 /var/www/html/${domain}/storage`,
      "Permissions set"
    );

    await ctx.reply(`
✅ Project setup complete!

📊 Database information:
- Name: ${dbName}
- User: ${dbUser}
- Password: ${dbPassword}

🔗 Your site should be accessible at: http://${domain}
(Make sure your domain is pointing to this server's IP address)
    `);

    // Clear session
    delete ctx.session.createProject;
  } catch (error) {
    await ctx.reply(`❌ Error during project setup: ${error.message}`);
  }
});

// Configure Project (Nginx and DB only)
bot.command("configure_project", (ctx) => {
  ctx.session = ctx.session || {};
  ctx.session.configureProject = { step: 1 };

  ctx.reply(`
Please provide the following information:

1. What is the domain name to configure? (e.g., example.com)
  `);
});

// Project Maintenance
bot.command("maintain_project", async (ctx) => {
  ctx.reply("Enter the domain name of the project to maintain:");
  ctx.session = ctx.session || {};
  ctx.session.waitingForDomainToMaintain = true;
});

bot.on(message("text"), async (ctx) => {
  const session = ctx.session || {};

  // Handle maintenance request
  if (session.waitingForDomainToMaintain) {
    const domain = ctx.message.text;
    delete session.waitingForDomainToMaintain;

    await ctx.reply(`Performing maintenance on ${domain}...`);

    const maintenanceCommand = `cd /var/www/html/${domain} && sudo chown -R $USER:$USER /var/www/html/${domain} && git pull && npm run build && php artisan optimize:clear && php artisan optimize && php artisan migrate && sudo chown -R www-data:www-data /var/www/html/${domain}`;

    await executeCommand(
      ctx,
      maintenanceCommand,
      `Maintenance completed for ${domain}`
    );
  }

  // Other message handlers can go here
});

// Error handling
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply(`❌ An error occurred: ${err.message}`);
});

// Start the bot
bot
  .launch()
  .then(() => {
    console.log("Laravel Server Management Bot is running!");
  })
  .catch((err) => {
    console.error("Failed to start bot:", err);
  });

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
