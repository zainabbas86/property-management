<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;

class MigrateUsersToQueue extends Command
{
    protected $signature   = 'users:migrate-to-queue';
    protected $description = 'Bulk-push all MySQL users onto the RabbitMQ migration queue. Does NOT fire userCreated events.';

    public function handle(): int
    {
        $host     = env('RABBITMQ_HOST', 'rabbitmq');
        $port     = (int) env('RABBITMQ_PORT', 5672);
        $user     = env('RABBITMQ_USER', 'guest');
        $password = env('RABBITMQ_PASSWORD', 'guest');

        $this->info("Connecting to RabbitMQ at {$host}:{$port}…");

        $connection = new AMQPStreamConnection($host, $port, $user, $password);
        $channel    = $connection->channel();

        // Durable — survives a RabbitMQ restart mid-migration
        $channel->queue_declare('users.migration', false, true, false, false);

        $users = User::all(['id', 'name', 'email', 'password']);
        $total = $users->count();

        if ($total === 0) {
            $this->warn('No users found in MySQL.');
            $channel->close();
            $connection->close();
            return Command::SUCCESS;
        }

        $this->info("Queueing {$total} user(s)…");
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        foreach ($users as $u) {
            $msg = new AMQPMessage(
                json_encode([
                    'id'       => $u->id,
                    'name'     => $u->name,
                    'email'    => $u->email,
                    'password' => $u->password, // already bcrypt-hashed; compatible with Node bcryptjs
                ]),
                ['delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT],
            );

            // Default exchange — routes directly to queue by name
            $channel->basic_publish($msg, '', 'users.migration');
            $bar->advance();
        }

        $bar->finish();
        $channel->close();
        $connection->close();

        $this->newLine(2);
        $this->info("Done — {$total} user(s) queued.");
        $this->comment('Watch consumption: docker compose logs -f user-service');

        return Command::SUCCESS;
    }
}
