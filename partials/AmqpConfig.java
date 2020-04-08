{% macro amqpConfig(asyncapi) %}
package com.asyncapi.infrastructure;

import com.asyncapi.service.MessageHandlerService;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.amqp.dsl.Amqp;
import org.springframework.integration.amqp.outbound.AmqpOutboundEndpoint;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.dsl.IntegrationFlow;
import org.springframework.integration.dsl.IntegrationFlows;
import org.springframework.messaging.MessageChannel;

@Configuration
public class Config {

    @Value("${amqp.broker.host}")
    private String host;

    @Value("${amqp.broker.port}")
    private int port;

    @Value("${amqp.broker.username}")
    private String username;

    @Value("${amqp.broker.password}")
    private String password;

    {% for channelName, channel in asyncapi.channels().publish() %}
    @Value("${amqp.exchange.{{- channelName -}}}")
    private String {{channelName}}Exchange;

    {% endfor %}
    {% for channelName, channel in asyncapi.channels().subscribe() %}
    @Value("${amqp.queue.{{- channelName -}}}")
    private String {{channelName}}Queue;

    {% endfor %}

    @Bean
    public ConnectionFactory connectionFactory() {
        CachingConnectionFactory connectionFactory = new CachingConnectionFactory(host);
        connectionFactory.setUsername(username);
        connectionFactory.setPassword(password);
        connectionFactory.setPort(port);
        return connectionFactory;
    }

    @Bean
    public AmqpAdmin amqpAdmin() {
        return new RabbitAdmin(connectionFactory());
    }

    @Bean
    public Declarables exchanges() {
        return new Declarables(
                {% for channelName, channel in asyncapi.channels().publish() %}
                new TopicExchange({{channelName}}Exchange, true, false){% if not loop.last %},{% endif %}
                {% endfor %}
                );
    }

    @Bean
    public Declarables queues() {
        return new Declarables(
                {% for channelName, channel in asyncapi.channels().subscribe() %}
                new Queue({{channelName}}Queue, true, false, false){% if not loop.last %},{% endif %}
                {% endfor %}
                );
    }

    // consumer

    @Autowired
    MessageHandlerService messageHandlerService;
    {% for channelName, channel in asyncapi.channels().subscribe() %}

    @Bean
    public IntegrationFlow {{channelName | camelCase}}Flow() {
        return IntegrationFlows.from(Amqp.inboundGateway(connectionFactory(), {{channelName}}Queue))
                .handle(messageHandlerService::handle{{channelName | upperFirst}})
                .get();
    }
    {% endfor %}

    // publisher

    @Bean
    public RabbitTemplate rabbitTemplate() {
        RabbitTemplate template = new RabbitTemplate(connectionFactory());
        return template;
    }
    {% for channelName, channel in asyncapi.channels().publish() %}

    @Bean
    public MessageChannel {{channelName | camelCase}}OutboundChannel() {
        return new DirectChannel();
    }

    @Bean
    @ServiceActivator(inputChannel = "{{channelName | camelCase}}OutboundChannel")
    public AmqpOutboundEndpoint {{channelName | camelCase}}Outbound(AmqpTemplate amqpTemplate) {
        AmqpOutboundEndpoint outbound = new AmqpOutboundEndpoint(amqpTemplate);
        outbound.setExchangeName({{channelName}}Exchange);
        outbound.setRoutingKey("#");
        return outbound;
    }
    {% endfor %}
}
{% endmacro %}
