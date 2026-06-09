<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use PhpAmqpLib\Connection\AMQPStreamConnection;

class ConsumeUserEvents extends Command
{
    protected $signature   = 'users:consume-events';
    protected $description = 'Long-running consumer: syncs user.created events from RabbitMQ into MySQL so Laravel FK integrity is maintained.';

    public function handle(): int
    {
        $host     = env('RABBITMQ_HOST', 'rabbitmq');
        $port     = (int) env('RABBITMQ_PORT', 5672);
        $user     = env('RABBITMQ_USER', 'guest');
        $password = env('RABBITMQ_PASSWORD', 'guest');

        $this->info("Connecting to RabbitMQ at {$host}:{$port}…");
        $connection = new AMQPStreamConnection($host, $port, $user, $password);
        $channel    = $connection->channel();

        // Mirror the exchange declared by user-service
        $channel->exchange_declare('app.events', 'topic', false, true, false);

        // Laravel-owned queue, bound to only the events we care about
        $channel->queue_declare('laravel.user-events', false, true, false, false);
        $channel->queue_bind('laravel.user-events', 'app.events', 'user.created');

        $this->info('Listening for user.created events (Ctrl+C to stop)…');

        $channel->basic_consume(
            'laravel.user-events',
            '',
            false,
            false,
            false,
            false,
            function ($msg) use ($channel) {
                $envelope = json_decode($msg->body, true);
                $data     = $envelope['data'] ?? [];

                $id    = $data['id']    ?? null;
                $name  = $data['name']  ?? null;
                $email = $data['email'] ?? null;

                if (!$id || !$name || !$email) {
                    $this->warn("Malformed event, nacking: {$msg->body}");
                    $channel->basic_nack($msg->delivery_info['delivery_tag'], false, false);
                    return;
                }

                // updateOrCreate so re-running or duplicate events are idempotent.
                // Password is a placeholder — this user authenticates via JWT/Auth Service only.
                User::updateOrCreate(
                    ['id' => $id],
                    [
                        'name'     => $name,
                        'email'    => $email,
                        'password' => '*',
                    ],
                );

                $channel->basic_ack($msg->delivery_info['delivery_tag']);
                $this->line("  [✓] synced user {$id} <{$email}> → MySQL");
            },
        );

        while (count($channel->callbacks)) {
            try {
                $channel->wait(null, false, 1.0);
            } catch (\PhpAmqpLib\Exception\AMQPTimeoutException $e) {
                // No message in 1s — keep polling
            }
        }

        $channel->close();
        $connection->close();

        return Command::SUCCESS;
    }
}
