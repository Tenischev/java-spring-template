package com.asyncapi.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class CommandLinePublisher implements CommandLineRunner {

    @Autowired
    PublisherService publisherService;

    @Override
    public void run(String... args) {
        System.out.println("******* Sending message: *******");

        {%- for channelName, channel in asyncapi.channels() %}
            {%- if channel.hasPublish() %}
        publisherService.{{channel.publish().id() | camelCase}}({% if asyncapi | isProtocol('kafka') %}new com.asyncapi.model.{{channel.publish().message().payload().uid() | camelCase | upperFirst}}(){% else %}"Hello World from {{channelName}}"{% endif %});
            {% endif -%}
        {%- endfor %}
        System.out.println("Message sent");
    }
}
