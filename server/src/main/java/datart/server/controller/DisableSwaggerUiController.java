package datart.server.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * @author xiaowei.song
 * @version v1.0.0
 * @description TODO
 * @date 2023/10/11 15:51
 */
@Profile("config")
@RestController
@Slf4j
public class DisableSwaggerUiController {

    @RequestMapping(value = "swagger-ui.html", method = RequestMethod.GET)
    public void getSwagger(HttpServletResponse httpResponse) throws IOException {
        httpResponse.setStatus(HttpStatus.NOT_FOUND.value());
    }
}

